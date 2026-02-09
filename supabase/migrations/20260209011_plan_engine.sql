-- Plan Engine: Versioned plans, phases, tasks, edges, runs, and test results
-- Adds structured mission planning with DAG dependencies and phase gating

-- ─── Mission Plans ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'superseded')),
  plan_summary TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mission_plans_mission ON mission_plans(mission_id, version DESC);
CREATE INDEX idx_mission_plans_status ON mission_plans(status);

-- ─── Plan Phases ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES mission_plans(id) ON DELETE CASCADE,
  phase_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  gate_type TEXT NOT NULL DEFAULT 'all_complete'
    CHECK (gate_type IN ('all_complete', 'review_approved', 'test_pass', 'manual_approval')),
  gate_config JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'passed', 'failed', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plan_phases_plan_order ON plan_phases(plan_id, phase_order);
CREATE INDEX idx_plan_phases_status ON plan_phases(plan_id, status);

-- ─── Plan Tasks ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES plan_phases(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES mission_plans(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  agent_id TEXT,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  domains TEXT[] DEFAULT '{}',
  review_enabled BOOLEAN DEFAULT FALSE,
  review_agent_id TEXT,
  review_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'blocked', 'ready', 'in_progress', 'review', 'done', 'failed', 'skipped')),
  input_context JSONB DEFAULT '{}'::jsonb,
  output_text TEXT,
  output_artifacts JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plan_tasks_phase_status ON plan_tasks(phase_id, status);
CREATE INDEX idx_plan_tasks_mission_status ON plan_tasks(mission_id, status);
CREATE INDEX idx_plan_tasks_plan ON plan_tasks(plan_id);
CREATE INDEX idx_plan_tasks_agent ON plan_tasks(agent_id);
CREATE INDEX idx_plan_tasks_task_key ON plan_tasks(plan_id, task_key);

-- ─── Plan Task Edges (DAG) ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_task_edges (
  from_task_id UUID NOT NULL REFERENCES plan_tasks(id) ON DELETE CASCADE,
  to_task_id UUID NOT NULL REFERENCES plan_tasks(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'blocks'
    CHECK (edge_type IN ('blocks', 'informs')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (from_task_id, to_task_id),
  CHECK (from_task_id <> to_task_id)
);

CREATE INDEX idx_plan_task_edges_to ON plan_task_edges(to_task_id);

-- ─── Plan Task Runs (Audit Trail) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES plan_tasks(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (run_type IN ('primary', 'review', 'test')),
  agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  prompt_text TEXT,
  output_text TEXT,
  output_artifacts JSONB DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plan_task_runs_task ON plan_task_runs(task_id);
CREATE INDEX idx_plan_task_runs_agent ON plan_task_runs(agent_id);
CREATE INDEX idx_plan_task_runs_status ON plan_task_runs(status);

-- ─── Plan Test Results ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES mission_plans(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES plan_phases(id) ON DELETE SET NULL,
  task_id UUID REFERENCES plan_tasks(id) ON DELETE SET NULL,
  test_type TEXT NOT NULL,
  command TEXT,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plan_test_results_plan ON plan_test_results(plan_id);
CREATE INDEX idx_plan_test_results_phase ON plan_test_results(phase_id);
CREATE INDEX idx_plan_test_results_task ON plan_test_results(task_id);
CREATE INDEX idx_plan_test_results_passed ON plan_test_results(passed);

-- ─── Alter missions table ─────────────────────────────────────────────────────

ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS active_plan_id UUID;
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS feedback_text TEXT;

-- Add FK constraint for active_plan_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_active_plan_id_fkey'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_active_plan_id_fkey
      FOREIGN KEY (active_plan_id) REFERENCES mission_plans(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE mission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_task_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_task_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_test_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mission_plans' AND policyname = 'Allow all on mission_plans'
  ) THEN
    CREATE POLICY "Allow all on mission_plans" ON mission_plans FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_phases' AND policyname = 'Allow all on plan_phases'
  ) THEN
    CREATE POLICY "Allow all on plan_phases" ON plan_phases FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_tasks' AND policyname = 'Allow all on plan_tasks'
  ) THEN
    CREATE POLICY "Allow all on plan_tasks" ON plan_tasks FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_task_edges' AND policyname = 'Allow all on plan_task_edges'
  ) THEN
    CREATE POLICY "Allow all on plan_task_edges" ON plan_task_edges FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_task_runs' AND policyname = 'Allow all on plan_task_runs'
  ) THEN
    CREATE POLICY "Allow all on plan_task_runs" ON plan_task_runs FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_test_results' AND policyname = 'Allow all on plan_test_results'
  ) THEN
    CREATE POLICY "Allow all on plan_test_results" ON plan_test_results FOR ALL USING (true);
  END IF;
END
$$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mission_plans;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE plan_phases;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE plan_tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE plan_task_runs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
