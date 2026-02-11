-- Add optional local_path to project_codebases
-- Allows a single codebase entry to have both a remote URL (github/gitlab)
-- and a local filesystem checkout path for agent file access.

ALTER TABLE project_codebases ADD COLUMN IF NOT EXISTS local_path TEXT;
