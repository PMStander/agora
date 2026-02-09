-- Migration: Memory Intelligence System
-- Tables: memory_embeddings, agent_learned_patterns, shared_priorities, memory_summaries
-- Enables pgvector for semantic search over agent memory

-- ─── Enable pgvector ────────────────────────────────────────────────────────

-- Note: In Supabase, vector extension should already be available
-- Skip extension creation and assume it exists

-- ─── Memory Embeddings ──────────────────────────────────────────────────────

-- Only create memory_embeddings table if vector type exists
DO $$
BEGIN
  -- Check if vector type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    -- Table creation is handled outside this block with IF NOT EXISTS
    RAISE NOTICE 'Vector type available, memory_embeddings table will be created';
  ELSE
    RAISE NOTICE 'Vector type not available, skipping memory_embeddings table creation';
  END IF;
END $$;

-- Create table without vector column - we'll add it conditionally
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('daily_note', 'long_term_memory', 'context_document', 'mission_output', 'chat_message', 'review_feedback')),
  source_id UUID NOT NULL,
  agent_id TEXT NOT NULL,
  content_text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add vector column only if vector type exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    -- Add the embedding column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute WHERE attrelid = 'memory_embeddings'::regclass AND attname = 'embedding'
    ) THEN
      ALTER TABLE memory_embeddings ADD COLUMN embedding vector(384);
    END IF;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_agent ON memory_embeddings(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_source ON memory_embeddings(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_created ON memory_embeddings(created_at DESC);

    -- HNSW index for vector similarity search
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_vector ON memory_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  ELSE
    -- Create basic indexes without vector
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_agent ON memory_embeddings(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_source ON memory_embeddings(source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_created ON memory_embeddings(created_at DESC);
  END IF;
END $$;

-- ─── Agent Learned Patterns ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('preference', 'mistake', 'success_pattern', 'rejection_reason', 'style_guide')),
  pattern TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 1,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  examples JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learned_patterns_agent ON agent_learned_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_type ON agent_learned_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learned_patterns_active ON agent_learned_patterns(active) WHERE active = true;

-- ─── Shared Priorities ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_rank INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  set_by TEXT NOT NULL DEFAULT 'user',
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'team', 'agent')),
  scope_target TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_priorities_rank ON shared_priorities(priority_rank) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_shared_priorities_scope ON shared_priorities(scope, scope_target);

-- ─── Memory Summaries ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memory_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('hourly', 'daily', 'weekly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  topics TEXT[] DEFAULT '{}',
  decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  summary_text TEXT NOT NULL,
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_summaries_agent ON memory_summaries(agent_id, summary_type);
CREATE INDEX IF NOT EXISTS idx_memory_summaries_period ON memory_summaries(period_start DESC, period_end);

-- ─── Semantic Search RPC ────────────────────────────────────────────────────

-- Note: This function requires the vector extension
-- Only create if vector type exists and embedding column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    WHERE t.typname = 'vector'
    AND a.attrelid = 'memory_embeddings'::regclass
    AND a.attname = 'embedding'
  ) THEN
    CREATE OR REPLACE FUNCTION match_memories(
      query_embedding vector(384),
      match_threshold FLOAT DEFAULT 0.5,
      match_count INT DEFAULT 10,
      filter_agent_id TEXT DEFAULT NULL,
      filter_source_types TEXT[] DEFAULT NULL
    )
    RETURNS TABLE (
      id UUID,
      source_type TEXT,
      source_id UUID,
      agent_id TEXT,
      content_text TEXT,
      metadata JSONB,
      similarity FLOAT
    )
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        me.id,
        me.source_type,
        me.source_id,
        me.agent_id,
        me.content_text,
        me.metadata,
        1 - (me.embedding <=> query_embedding) AS similarity
      FROM memory_embeddings me
      WHERE
        (filter_agent_id IS NULL OR me.agent_id = filter_agent_id)
        AND (filter_source_types IS NULL OR me.source_type = ANY(filter_source_types))
        AND (1 - (me.embedding <=> query_embedding)) > match_threshold
      ORDER BY me.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $func$;
    RAISE NOTICE 'Created match_memories function';
  ELSE
    RAISE NOTICE 'Vector type or embedding column not available, skipping match_memories function creation';
  END IF;
END $$;

-- ─── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE memory_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memory_embeddings' AND policyname = 'Allow all on memory_embeddings') THEN
    CREATE POLICY "Allow all on memory_embeddings" ON memory_embeddings FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_learned_patterns' AND policyname = 'Allow all on agent_learned_patterns') THEN
    CREATE POLICY "Allow all on agent_learned_patterns" ON agent_learned_patterns FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_priorities' AND policyname = 'Allow all on shared_priorities') THEN
    CREATE POLICY "Allow all on shared_priorities" ON shared_priorities FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memory_summaries' AND policyname = 'Allow all on memory_summaries') THEN
    CREATE POLICY "Allow all on memory_summaries" ON memory_summaries FOR ALL USING (true);
  END IF;
END $$;

-- ─── Realtime Publication ───────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shared_priorities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_learned_patterns;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memory_summaries;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
