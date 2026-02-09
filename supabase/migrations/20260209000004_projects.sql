-- ============================================================================
-- Phase 3: Projects
-- ============================================================================

-- ─── Projects ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),

  -- CRM links
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Management
  owner_agent_id TEXT,
  budget NUMERIC(15,2),
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Dates
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,

  -- Extensibility
  tags TEXT[] NOT NULL DEFAULT '{}',
  custom_fields JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_deal ON projects(deal_id);
CREATE INDEX idx_projects_contact ON projects(contact_id);
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- ─── Project ↔ Mission Junction ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_missions (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, mission_id)
);

CREATE INDEX idx_project_missions_mission ON project_missions(mission_id);

-- ─── Add deferred FK from deals.project_id → projects ──────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_deals_project'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT fk_deals_project
      FOREIGN KEY (project_id) REFERENCES projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on project_missions" ON project_missions FOR ALL USING (true) WITH CHECK (true);

-- ─── Realtime ──────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE projects, project_missions;
