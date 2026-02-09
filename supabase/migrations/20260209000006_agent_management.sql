-- ============================================================================
-- CONSOLIDATED AGENT MANAGEMENT MIGRATION
-- Combines: Hiring/SOUL, Leveling Framework, Reviews & Context
-- Migration: 20260209000006_agent_management.sql
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- A. AGENT TABLE EXTENSIONS (Hiring & SOUL)
-- ═══════════════════════════════════════════════════════════════════════════

-- Add SOUL profile as JSONB (the full SoulProfile object)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul JSONB DEFAULT '{}'::jsonb;

-- Add lifecycle status
ALTER TABLE agents ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';

-- Add hiring metadata
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

-- Add onboarding checklist as JSONB array
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '[]'::jsonb;

-- Add creation metadata
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system';

-- Add SOUL version tracking
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_version INTEGER DEFAULT 1;

-- Add skills array
ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Add model/provider configuration per agent
ALTER TABLE agents ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'anthropic';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Add emoji (was only in the frontend before)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Agent Registry extensions (from reviews & context design)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'available';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_missions_completed INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avg_quality_score NUMERIC(3,2) DEFAULT 0.00;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS response_time_avg_minutes NUMERIC(8,2) DEFAULT 0.00;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- Add CHECK constraints via DO blocks to avoid failures on re-run
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_lifecycle_status_check'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_lifecycle_status_check
      CHECK (lifecycle_status IN ('candidate', 'onboarding', 'active', 'suspended', 'retired')) NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_created_by_check'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_created_by_check
      CHECK (created_by IN ('user', 'system', 'ai_suggested')) NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_availability_check'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_availability_check
      CHECK (availability IN ('available', 'busy', 'offline')) NOT VALID;
  END IF;
END $$;

-- Indexes for agents extensions
CREATE INDEX IF NOT EXISTS idx_agents_lifecycle ON agents(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_agents_availability ON agents(availability);
CREATE INDEX IF NOT EXISTS idx_agents_level ON agents(level);
CREATE INDEX IF NOT EXISTS idx_agents_domains ON agents USING GIN(domains);
CREATE INDEX IF NOT EXISTS idx_agents_skills ON agents USING GIN(skills);

-- Backfill existing agents as 'active' with 'system' creation
UPDATE agents
SET lifecycle_status = 'active',
    created_by = 'system',
    hired_at = created_at,
    onboarded_at = created_at
WHERE lifecycle_status IS NULL OR lifecycle_status = 'active';

-- ═══════════════════════════════════════════════════════════════════════════
-- B. AGENT SOUL HISTORY
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_soul_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  soul JSONB NOT NULL,
  changed_by TEXT DEFAULT 'user',
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_soul_history_agent ON agent_soul_history(agent_id, version DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- C. AGENT LEVELING FRAMEWORK
-- ═══════════════════════════════════════════════════════════════════════════

-- Agent level state table
CREATE TABLE IF NOT EXISTS agent_levels (
  agent_id TEXT PRIMARY KEY,
  current_level SMALLINT NOT NULL DEFAULT 1
    CHECK (current_level BETWEEN 1 AND 4),
  guardrails JSONB NOT NULL DEFAULT '{
    "allowed_domains": [],
    "allowed_actions": [],
    "denied_actions": [],
    "max_concurrent_missions": 1,
    "max_daily_tasks": 5,
    "escalation_agent_id": null,
    "auto_review_threshold": 0.7
  }'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{
    "tasks_completed": 0,
    "avg_review_score": 0,
    "violations_30d": 0,
    "critical_violations_7d": 0,
    "consecutive_failures": 0,
    "time_in_level_days": 0
  }'::jsonb,
  level_assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Level history table
CREATE TABLE IF NOT EXISTS agent_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  from_level SMALLINT NOT NULL CHECK (from_level BETWEEN 1 AND 4),
  to_level SMALLINT NOT NULL CHECK (to_level BETWEEN 1 AND 4),
  trigger TEXT NOT NULL CHECK (trigger IN ('promotion', 'demotion', 'manual_override')),
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL CHECK (approved_by IN ('system', 'human')),
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_level_history_agent
  ON agent_level_history(agent_id, created_at DESC);

-- Level transition requests (pending approvals)
CREATE TABLE IF NOT EXISTS agent_level_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  from_level SMALLINT NOT NULL CHECK (from_level BETWEEN 1 AND 4),
  to_level SMALLINT NOT NULL CHECK (to_level BETWEEN 1 AND 4),
  trigger TEXT NOT NULL CHECK (trigger IN ('promotion', 'demotion', 'manual_override')),
  reason TEXT NOT NULL,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_level_transitions_agent
  ON agent_level_transitions(agent_id, status);

-- Guardrail violations log
CREATE TABLE IF NOT EXISTS guardrail_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  action_attempted TEXT NOT NULL,
  guardrail_violated TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  resolution TEXT NOT NULL DEFAULT 'auto_denied'
    CHECK (resolution IN ('auto_denied', 'escalated', 'human_overridden', 'approved')),
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_violations_agent
  ON guardrail_violations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_violations_severity
  ON guardrail_violations(severity, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- D. PERFORMANCE REVIEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Review Schedule: configures when reviews trigger per agent
CREATE TABLE IF NOT EXISTS review_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'monthly'
    CHECK (cadence IN ('weekly', 'monthly', 'quarterly')),
  next_review_at TIMESTAMPTZ NOT NULL,
  milestone_threshold INTEGER,
  quality_alert_threshold NUMERIC(3,2),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_schedules_agent ON review_schedules(agent_id);
CREATE INDEX IF NOT EXISTS idx_review_schedules_next ON review_schedules(next_review_at)
  WHERE enabled = true;

-- Performance Reviews: the core review record
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'milestone', 'alert')),
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'narrative_ready', 'user_review', 'finalized')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative TEXT,
  ratings JSONB,
  user_notes TEXT,
  level_recommendation TEXT CHECK (level_recommendation IN ('maintain', 'promote', 'demote')),
  level_justification TEXT,
  agent_feedback TEXT,
  level_change_applied BOOLEAN NOT NULL DEFAULT false,
  previous_level INTEGER,
  new_level INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_agent ON performance_reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_status ON performance_reviews(status);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_period ON performance_reviews(period_start, period_end);

-- Level Change History: audit trail of all level transitions
CREATE TABLE IF NOT EXISTS level_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  review_id UUID REFERENCES performance_reviews(id) ON DELETE SET NULL,
  previous_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('review_promotion', 'review_demotion', 'initial_hire', 'manual_adjustment')),
  justification TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_changes_agent ON level_changes(agent_id);
CREATE INDEX IF NOT EXISTS idx_level_changes_review ON level_changes(review_id);

-- Agent Feedback Log
CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  review_id UUID REFERENCES performance_reviews(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('review_summary', 'praise', 'improvement_area', 'directive')),
  content TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent ON agent_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_review ON agent_feedback(review_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- E. SHARED CONTEXT TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Project Context: top-level container per project/mission
CREATE TABLE IF NOT EXISTS project_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  last_updated_by_agent_id TEXT NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_contexts_project ON project_contexts(project_id);

-- Context Access: who can read/write/admin each project context
CREATE TABLE IF NOT EXISTS context_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_context_id UUID NOT NULL REFERENCES project_contexts(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read'
    CHECK (access_level IN ('read', 'write', 'admin')),
  granted_by TEXT NOT NULL DEFAULT 'user',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_context_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_context_access_agent ON context_access(agent_id);
CREATE INDEX IF NOT EXISTS idx_context_access_project ON context_access(project_context_id);

-- Context Documents: CONTEXT.md, research docs, decision logs
CREATE TABLE IF NOT EXISTS context_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_context_id UUID NOT NULL REFERENCES project_contexts(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'context'
    CHECK (doc_type IN ('access', 'context', 'research', 'decision_log')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  last_updated_by_agent_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_documents_project ON context_documents(project_context_id);
CREATE INDEX IF NOT EXISTS idx_context_documents_type ON context_documents(doc_type);

-- Context Revisions: append-only audit trail of document changes
CREATE TABLE IF NOT EXISTS context_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_document_id UUID NOT NULL REFERENCES context_documents(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  diff_summary TEXT NOT NULL,
  content_snapshot TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_revisions_doc ON context_revisions(context_document_id, version DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- F. HANDOFF PROTOCOL
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS handoff_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  context_summary TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'accepted', 'in_progress', 'completed', 'declined', 'timed_out')),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  time_taken_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_requesting ON handoff_requests(requesting_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_target ON handoff_requests(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoff_requests(status);
CREATE INDEX IF NOT EXISTS idx_handoffs_task ON handoff_requests(task_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- G. THREE-TIER MEMORY
-- ═══════════════════════════════════════════════════════════════════════════

-- Daily Notes: raw activity logs per agent per day
CREATE TABLE IF NOT EXISTS daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_agent_date ON daily_notes(agent_id, note_date DESC);

-- Long-term Memory: curated insights per agent
CREATE TABLE IF NOT EXISTS long_term_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('insight', 'pattern', 'preference', 'skill_learned', 'mistake_learned')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_daily_note_id UUID REFERENCES daily_notes(id) ON DELETE SET NULL,
  source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  relevance_score NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_referenced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_long_term_memories_agent ON long_term_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_category ON long_term_memories(category);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_tags ON long_term_memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_relevance ON long_term_memories(relevance_score DESC);

-- Cross-project Insights
CREATE TABLE IF NOT EXISTS cross_project_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent_id TEXT NOT NULL,
  source_project_context_id UUID REFERENCES project_contexts(id) ON DELETE SET NULL,
  insight TEXT NOT NULL,
  applicable_domains TEXT[] DEFAULT '{}',
  propagated_to UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cross_insights_agent ON cross_project_insights(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_cross_insights_domains ON cross_project_insights USING GIN(applicable_domains);

-- ═══════════════════════════════════════════════════════════════════════════
-- H. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE agent_soul_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_level_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_level_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_term_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_project_insights ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- I. PERMISSIVE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_soul_history' AND policyname = 'Allow all on agent_soul_history') THEN CREATE POLICY "Allow all on agent_soul_history" ON agent_soul_history FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_levels' AND policyname = 'Allow all on agent_levels') THEN CREATE POLICY "Allow all on agent_levels" ON agent_levels FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_level_history' AND policyname = 'Allow all on agent_level_history') THEN CREATE POLICY "Allow all on agent_level_history" ON agent_level_history FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_level_transitions' AND policyname = 'Allow all on agent_level_transitions') THEN CREATE POLICY "Allow all on agent_level_transitions" ON agent_level_transitions FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardrail_violations' AND policyname = 'Allow all on guardrail_violations') THEN CREATE POLICY "Allow all on guardrail_violations" ON guardrail_violations FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_schedules' AND policyname = 'Allow all on review_schedules') THEN CREATE POLICY "Allow all on review_schedules" ON review_schedules FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'performance_reviews' AND policyname = 'Allow all on performance_reviews') THEN CREATE POLICY "Allow all on performance_reviews" ON performance_reviews FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'level_changes' AND policyname = 'Allow all on level_changes') THEN CREATE POLICY "Allow all on level_changes" ON level_changes FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_feedback' AND policyname = 'Allow all on agent_feedback') THEN CREATE POLICY "Allow all on agent_feedback" ON agent_feedback FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_contexts' AND policyname = 'Allow all on project_contexts') THEN CREATE POLICY "Allow all on project_contexts" ON project_contexts FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'context_access' AND policyname = 'Allow all on context_access') THEN CREATE POLICY "Allow all on context_access" ON context_access FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'context_documents' AND policyname = 'Allow all on context_documents') THEN CREATE POLICY "Allow all on context_documents" ON context_documents FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'context_revisions' AND policyname = 'Allow all on context_revisions') THEN CREATE POLICY "Allow all on context_revisions" ON context_revisions FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'handoff_requests' AND policyname = 'Allow all on handoff_requests') THEN CREATE POLICY "Allow all on handoff_requests" ON handoff_requests FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_notes' AND policyname = 'Allow all on daily_notes') THEN CREATE POLICY "Allow all on daily_notes" ON daily_notes FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'long_term_memories' AND policyname = 'Allow all on long_term_memories') THEN CREATE POLICY "Allow all on long_term_memories" ON long_term_memories FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cross_project_insights' AND policyname = 'Allow all on cross_project_insights') THEN CREATE POLICY "Allow all on cross_project_insights" ON cross_project_insights FOR ALL USING (true); END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- J. REALTIME PUBLICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_levels; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE guardrail_violations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_level_transitions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE performance_reviews; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE handoff_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE context_documents; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE daily_notes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- K. SEED DATA - Agent Levels
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO agent_levels (agent_id, current_level, guardrails) VALUES
  ('main', 4, '{"allowed_domains": ["*"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 10, "max_daily_tasks": 50, "escalation_agent_id": null, "auto_review_threshold": 0.5}'),
  ('hippocrates', 1, '{"allowed_domains": ["fitness", "health", "nutrition"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('confucius', 1, '{"allowed_domains": ["family", "relationships"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('seneca', 1, '{"allowed_domains": ["personal-finance", "budgeting", "investing"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('archimedes', 1, '{"allowed_domains": ["technology", "gadgets", "coding"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('leonidas', 1, '{"allowed_domains": ["business-strategy", "leadership"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 2, "max_daily_tasks": 10, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('odysseus', 1, '{"allowed_domains": ["finance"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('spartacus', 1, '{"allowed_domains": ["hr", "recruitment"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('achilles', 1, '{"allowed_domains": ["tech-infrastructure", "development", "coding"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 2, "max_daily_tasks": 10, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('alexander', 1, '{"allowed_domains": ["marketing", "sales"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}')
ON CONFLICT (agent_id) DO NOTHING;
