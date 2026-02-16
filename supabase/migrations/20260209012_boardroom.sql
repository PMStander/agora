-- ============================================================================
-- BOARDROOM SESSIONS & MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS boardroom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  session_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (session_type IN ('standup', 'task_review', 'strategy', 'brainstorm', 'watercooler', 'debate', 'war_room', 'custom')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('scheduled', 'preparing', 'open', 'active', 'closed')),
  participant_agent_ids TEXT[] NOT NULL DEFAULT '{}',
  current_turn_agent_id TEXT,
  turn_count INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL DEFAULT 10,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'user',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boardroom_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES boardroom_sessions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  reasoning TEXT,
  turn_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_boardroom_sessions_status ON boardroom_sessions(status);
CREATE INDEX IF NOT EXISTS idx_boardroom_sessions_created ON boardroom_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_boardroom_sessions_scheduled ON boardroom_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_session ON boardroom_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_boardroom_messages_turn ON boardroom_messages(session_id, turn_number);

-- RLS
ALTER TABLE boardroom_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boardroom_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boardroom_sessions' AND policyname = 'Allow all on boardroom_sessions') THEN CREATE POLICY "Allow all on boardroom_sessions" ON boardroom_sessions FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'boardroom_messages' AND policyname = 'Allow all on boardroom_messages') THEN CREATE POLICY "Allow all on boardroom_messages" ON boardroom_messages FOR ALL USING (true); END IF; END $$;

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE boardroom_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE boardroom_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
