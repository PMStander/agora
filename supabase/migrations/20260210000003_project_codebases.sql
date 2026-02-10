-- Project Codebases: linked code repositories for project context awareness
-- Agents will be informed of these codebases when working in project context

CREATE TABLE IF NOT EXISTS project_codebases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'local'
    CHECK (source_type IN ('local', 'github', 'gitlab', 'bitbucket', 'url')),
  path TEXT NOT NULL,
  branch TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_codebases_project ON project_codebases(project_id);

ALTER TABLE project_codebases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on project_codebases" ON project_codebases
  FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE project_codebases;
