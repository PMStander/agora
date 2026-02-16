-- ============================================================================
-- BOARDROOM CHAT MODE EXTENSIONS
-- Adds project-scoped chat sessions, user messages, and mention support
-- ============================================================================

-- Add project_id to sessions (nullable — existing sessions don't have one)
ALTER TABLE boardroom_sessions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_boardroom_sessions_project ON boardroom_sessions(project_id) WHERE project_id IS NOT NULL;

-- Expand session_type to include 'chat'
ALTER TABLE boardroom_sessions DROP CONSTRAINT IF EXISTS boardroom_sessions_session_type_check;
ALTER TABLE boardroom_sessions ADD CONSTRAINT boardroom_sessions_session_type_check
  CHECK (session_type IN ('standup','task_review','strategy','brainstorm','watercooler','debate','war_room','custom','chat'));

-- Extend messages for chat mode: sender_type distinguishes user vs agent messages
ALTER TABLE boardroom_messages ADD COLUMN IF NOT EXISTS sender_type TEXT NOT NULL DEFAULT 'agent'
  CHECK (sender_type IN ('user','agent','system'));

-- Mentions JSONB array for @agent and @entity references
ALTER TABLE boardroom_messages ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
