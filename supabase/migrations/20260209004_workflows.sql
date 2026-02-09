-- ============================================================================
-- WORKFLOW AUTOMATION
-- ============================================================================

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN (
      'entity_created', 'entity_updated', 'field_changed',
      'stage_changed', 'deal_won', 'deal_lost',
      'schedule', 'manual', 'webhook'
    )),
  trigger_entity TEXT
    CHECK (trigger_entity IN ('contact', 'company', 'deal', 'order', 'invoice', 'quote', 'project')),
  trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger_schedule TEXT,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_agent_id TEXT,
  run_count INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type, trigger_entity);
CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created ON workflows(created_at DESC);

-- Workflow Runs table
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'waiting')),
  trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step INT NOT NULL DEFAULT 0,
  steps_completed INT NOT NULL DEFAULT 0,
  steps_total INT NOT NULL DEFAULT 0,
  error_message TEXT,
  entity_type TEXT,
  entity_id UUID,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created ON workflow_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_entity ON workflow_runs(entity_type, entity_id);

-- Workflow Sequences table (multi-step sales sequences)
CREATE TABLE IF NOT EXISTS workflow_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_sequences_status ON workflow_sequences(status);
CREATE INDEX IF NOT EXISTS idx_workflow_sequences_owner ON workflow_sequences(owner_agent_id);

-- RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_sequences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflows' AND policyname = 'Allow all on workflows') THEN CREATE POLICY "Allow all on workflows" ON workflows FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_runs' AND policyname = 'Allow all on workflow_runs') THEN CREATE POLICY "Allow all on workflow_runs" ON workflow_runs FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_sequences' AND policyname = 'Allow all on workflow_sequences') THEN CREATE POLICY "Allow all on workflow_sequences" ON workflow_sequences FOR ALL USING (true); END IF; END $$;

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workflows; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workflow_runs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workflow_sequences; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
