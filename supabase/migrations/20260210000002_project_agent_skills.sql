-- ─── Project Agent Skills ─────────────────────────────────────────────────────
-- Stores which skills an agent gets ONLY when working on a specific project.
-- skill_type = 'technology': labels like angular, vuejs — injected as context
-- skill_type = 'gateway': actual tool skills — hot-swapped in gateway config

CREATE TABLE IF NOT EXISTS project_agent_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  skill_key TEXT NOT NULL,
  skill_type TEXT NOT NULL DEFAULT 'technology'
    CHECK (skill_type IN ('technology', 'gateway')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, agent_id, skill_key)
);

CREATE INDEX IF NOT EXISTS idx_pas_project ON project_agent_skills(project_id);
CREATE INDEX IF NOT EXISTS idx_pas_agent ON project_agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_pas_project_agent ON project_agent_skills(project_id, agent_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE project_agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on project_agent_skills" ON project_agent_skills
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE project_agent_skills;
