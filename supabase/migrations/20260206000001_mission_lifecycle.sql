-- Mission lifecycle migration: statement -> plan -> tasks with dependency gating

ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_statement TEXT;
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_plan TEXT;
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_phase TEXT DEFAULT 'statement';
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_phase_status TEXT DEFAULT 'awaiting_approval';
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_status TEXT DEFAULT 'scheduled';

UPDATE missions SET mission_status = status WHERE mission_status IS NULL;
UPDATE missions SET mission_phase = 'tasks' WHERE mission_phase IS NULL;
UPDATE missions SET mission_phase_status = 'approved' WHERE mission_phase_status IS NULL;

ALTER TABLE IF EXISTS missions ALTER COLUMN mission_status SET DEFAULT 'scheduled';
ALTER TABLE IF EXISTS missions ALTER COLUMN mission_phase SET DEFAULT 'statement';
ALTER TABLE IF EXISTS missions ALTER COLUMN mission_phase_status SET DEFAULT 'awaiting_approval';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_mission_phase_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_mission_phase_check
      CHECK (mission_phase IN ('statement', 'plan', 'tasks')) NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_mission_phase_status_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_mission_phase_status_check
      CHECK (mission_phase_status IN ('draft', 'awaiting_approval', 'approved')) NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_mission_status_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_mission_status_check
      CHECK (mission_status IN ('scheduled', 'assigned', 'in_progress', 'pending_review', 'revision', 'done', 'failed')) NOT VALID;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

ALTER TABLE IF EXISTS task_dependencies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_dependencies' AND policyname = 'Allow all on task_dependencies'
  ) THEN
    CREATE POLICY "Allow all on task_dependencies" ON task_dependencies FOR ALL USING (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_missions_phase ON missions(mission_phase, mission_phase_status);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(mission_status);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
