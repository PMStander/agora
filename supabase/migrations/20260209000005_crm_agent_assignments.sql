-- ═══════════════════════════════════════════════════════════════════════════
-- CRM Agent Assignments
-- Links agents to CRM entities with role-based assignments
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_agent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('contact', 'company', 'deal', 'project', 'order')),
  entity_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'collaborator', 'watcher')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, entity_type, entity_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_agent_assignments_agent ON crm_agent_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_crm_agent_assignments_entity ON crm_agent_assignments(entity_type, entity_id);

-- RLS
ALTER TABLE crm_agent_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_agent_assignments' AND policyname = 'Allow all on crm_agent_assignments'
  ) THEN
    CREATE POLICY "Allow all on crm_agent_assignments" ON crm_agent_assignments FOR ALL USING (true);
  END IF;
END $$;

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm_agent_assignments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
