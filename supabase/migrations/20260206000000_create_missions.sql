-- ============================================================================
-- Create core Mission Control and Agent Management tables
-- ============================================================================

-- ─── Agents table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  
  -- Basic identity
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  emoji TEXT,
  avatar TEXT,
  persona TEXT,
  team TEXT NOT NULL DEFAULT 'business'
    CHECK (team IN ('orchestrator', 'personal', 'business', 'engineering')),
  
  -- Model configuration
  provider TEXT NOT NULL DEFAULT 'anthropic',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
  skills TEXT[] NOT NULL DEFAULT '{}',
  
  -- Domain expertise
  domains TEXT[] NOT NULL DEFAULT '{}',
  
  -- Leveling (will be extended by agent_management migration)
  level INTEGER NOT NULL DEFAULT 1,
  total_missions_completed INTEGER NOT NULL DEFAULT 0,
  avg_quality_score NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  response_time_avg_minutes NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Availability
  availability TEXT NOT NULL DEFAULT 'available'
    CHECK (availability IN ('available', 'busy', 'offline', 'do_not_disturb')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_agents_team ON agents(team);
CREATE INDEX idx_agents_level ON agents(level);
CREATE INDEX idx_agents_availability ON agents(availability);
CREATE INDEX idx_agents_last_active ON agents(last_active_at DESC);
CREATE INDEX idx_agents_domains ON agents USING GIN(domains);
CREATE INDEX idx_agents_skills ON agents USING GIN(skills);

-- ─── Missions table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic fields
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'assigned', 'in_progress', 'pending_review', 'revision', 'done', 'failed')),
  
  -- Mission lifecycle fields
  mission_status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (mission_status IN ('scheduled', 'assigned', 'in_progress', 'pending_review', 'revision', 'done', 'failed')),
  mission_phase TEXT NOT NULL DEFAULT 'statement'
    CHECK (mission_phase IN ('statement', 'plan', 'tasks')),
  mission_phase_status TEXT NOT NULL DEFAULT 'awaiting_approval'
    CHECK (mission_phase_status IN ('draft', 'awaiting_approval', 'approved')),
  mission_statement TEXT,
  mission_plan TEXT,
  
  -- Priority and scheduling
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Agent assignment
  agent_id TEXT NOT NULL,
  
  -- Input/Output
  input_text TEXT,
  input_media JSONB NOT NULL DEFAULT '[]',
  output_text TEXT,
  output_media JSONB NOT NULL DEFAULT '[]',
  
  -- Review process
  review_enabled BOOLEAN NOT NULL DEFAULT false,
  review_agent_id TEXT,
  review_notes TEXT,
  feedback_text TEXT,
  
  -- Revision handling
  parent_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  revision_round INT NOT NULL DEFAULT 0,
  max_revisions INT NOT NULL DEFAULT 3,
  reopened_at TIMESTAMPTZ,
  
  -- Metadata
  created_by TEXT NOT NULL,
  session_key TEXT,
  domains TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_mission_status ON missions(mission_status);
CREATE INDEX idx_missions_phase ON missions(mission_phase, mission_phase_status);
CREATE INDEX idx_missions_agent ON missions(agent_id);
CREATE INDEX idx_missions_scheduled ON missions(scheduled_at);
CREATE INDEX idx_missions_parent ON missions(parent_mission_id);
CREATE INDEX idx_missions_created_by ON missions(created_by);

-- ─── Mission Logs table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  agent_id TEXT,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_mission_logs_mission ON mission_logs(mission_id);
CREATE INDEX idx_mission_logs_type ON mission_logs(type);
CREATE INDEX idx_mission_logs_created ON mission_logs(created_at DESC);

-- ─── Tasks table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic fields
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'blocked', 'in_progress', 'review', 'done', 'failed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Scheduling
  due_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Agent assignment
  primary_agent_id TEXT NOT NULL,
  assignees JSONB NOT NULL DEFAULT '[]',
  
  -- Review process
  review_enabled BOOLEAN NOT NULL DEFAULT false,
  review_agent_id TEXT,
  max_revisions INT NOT NULL DEFAULT 3,
  revision_round INT NOT NULL DEFAULT 0,
  review_notes TEXT,
  review_history JSONB NOT NULL DEFAULT '[]',
  
  -- Task hierarchy
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  root_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  linked_revision_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Input/Output
  input_text TEXT,
  input_media JSONB NOT NULL DEFAULT '[]',
  output_text TEXT,
  
  -- Execution tracking
  dependency_task_ids TEXT[] NOT NULL DEFAULT '{}',
  active_run_id TEXT,
  active_phase TEXT CHECK (active_phase IN ('primary', 'review')),
  active_thinking TEXT,
  active_summary TEXT,
  error_message TEXT,
  
  -- Domains and metadata
  domains TEXT[] NOT NULL DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_agent ON tasks(primary_agent_id);
CREATE INDEX idx_tasks_due ON tasks(due_at);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_root ON tasks(root_task_id);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);

-- ─── Enable RLS ────────────────────────────────────────────────────────────

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Allow all operations (for development - adjust for production)
CREATE POLICY "Allow all on missions" ON missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on mission_logs" ON mission_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on agents" ON agents FOR ALL USING (true) WITH CHECK (true);

-- ─── Enable Realtime ───────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE missions, mission_logs, tasks, agents;

-- ─── Trigger for updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_missions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_missions_updated_at
  BEFORE UPDATE ON missions
  FOR EACH ROW
  EXECUTE FUNCTION update_missions_updated_at();

CREATE TRIGGER trigger_update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

CREATE TRIGGER trigger_update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_agents_updated_at();
