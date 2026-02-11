-- Migration: Entity Embedding Infrastructure
-- Tables: embedding_queue, entity_embeddings
-- Enables vector embeddings for all Agora entities with hybrid search (semantic + keyword)

-- ─── Enable Extensions ──────────────────────────────────────────────────────

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'vector extension not available: %', SQLERRM;
END
$$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm extension not available: %', SQLERRM;
END
$$;

-- ─── Embedding Queue ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Batch polling index: grab pending items ordered by priority then age
CREATE INDEX IF NOT EXISTS idx_embedding_queue_poll
  ON embedding_queue (status, priority DESC, created_at);

-- Dedup index: one queue entry per entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_queue_entity
  ON embedding_queue (entity_type, entity_id);

-- ─── Entity Embeddings ────────────────────────────────────────────────────────

-- Only create entity_embeddings table if vector type exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    RAISE NOTICE 'Vector type available, entity_embeddings table will be created';
  ELSE
    RAISE NOTICE 'Vector type not available, skipping vector-dependent features';
  END IF;
END $$;

-- Create table without vector column - we'll add it conditionally
CREATE TABLE IF NOT EXISTS entity_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'company', 'contact', 'deal', 'interaction',
    'product', 'product_category',
    'order', 'quote', 'invoice',
    'project', 'mission', 'task',
    'email', 'email_template',
    'calendar_event',
    'workflow', 'workflow_sequence',
    'document', 'crm_document',
    'agent', 'boardroom_message', 'notification'
  )),
  entity_id UUID NOT NULL,
  content_text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  model TEXT NOT NULL DEFAULT 'gemini-embedding-001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one embedding per entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_embeddings_unique
  ON entity_embeddings (entity_type, entity_id);

-- Add vector column and indexes only if vector type exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    -- Add the embedding column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute WHERE attrelid = 'entity_embeddings'::regclass AND attname = 'embedding'
    ) THEN
      ALTER TABLE entity_embeddings ADD COLUMN embedding vector(768);
    END IF;

    -- Basic indexes
    CREATE INDEX IF NOT EXISTS idx_entity_embeddings_type ON entity_embeddings(entity_type);
    CREATE INDEX IF NOT EXISTS idx_entity_embeddings_created ON entity_embeddings(created_at DESC);

    -- HNSW index for vector similarity search
    CREATE INDEX IF NOT EXISTS idx_entity_embeddings_vector ON entity_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);

    -- GIN trigram index for hybrid keyword search
    CREATE INDEX IF NOT EXISTS idx_entity_embeddings_trgm ON entity_embeddings
      USING gin (content_text gin_trgm_ops);
  ELSE
    -- Create basic indexes without vector
    CREATE INDEX IF NOT EXISTS idx_entity_embeddings_type ON entity_embeddings(entity_type);
    CREATE INDEX IF NOT EXISTS idx_entity_embeddings_created ON entity_embeddings(created_at DESC);

    -- GIN trigram index still useful without vector
    CREATE INDEX IF NOT EXISTS idx_entity_embeddings_trgm ON entity_embeddings
      USING gin (content_text gin_trgm_ops);
  END IF;
END $$;

-- ─── Trigger Function: Queue Entity for Embedding ────────────────────────────

CREATE OR REPLACE FUNCTION fn_queue_entity_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entity_type TEXT;
  v_old_json JSONB;
  v_new_json JSONB;
  v_changed BOOLEAN := true;
BEGIN
  -- Entity type is passed as the first trigger argument
  v_entity_type := TG_ARGV[0];

  -- On UPDATE, check if meaningful columns changed (skip timestamp-only changes)
  IF TG_OP = 'UPDATE' THEN
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);

    -- Remove timestamp fields that don't indicate meaningful change
    v_old_json := v_old_json - 'updated_at' - 'created_at' - 'processed_at' - 'last_synced_at';
    v_new_json := v_new_json - 'updated_at' - 'created_at' - 'processed_at' - 'last_synced_at';

    -- If the non-timestamp data is identical, skip queueing
    IF v_old_json = v_new_json THEN
      v_changed := false;
    END IF;
  END IF;

  -- Only queue if this is an INSERT or a meaningful UPDATE
  IF v_changed THEN
    INSERT INTO embedding_queue (entity_type, entity_id, priority, status, attempts, error_message, created_at)
    VALUES (v_entity_type, NEW.id, 0, 'pending', 0, NULL, now())
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
      status = 'pending',
      attempts = 0,
      error_message = NULL,
      created_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Triggers on Entity Tables ────────────────────────────────────────────────

-- Helper: create triggers idempotently
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('trg_embed_companies',          'companies',          'company'),
      ('trg_embed_contacts',           'contacts',           'contact'),
      ('trg_embed_deals',              'deals',              'deal'),
      ('trg_embed_crm_interactions',   'crm_interactions',   'interaction'),
      ('trg_embed_products',           'products',           'product'),
      ('trg_embed_product_categories', 'product_categories', 'product_category'),
      ('trg_embed_orders',             'orders',             'order'),
      ('trg_embed_quotes',             'quotes',             'quote'),
      ('trg_embed_invoices',           'invoices',           'invoice'),
      ('trg_embed_projects',           'projects',           'project'),
      ('trg_embed_missions',           'missions',           'mission'),
      ('trg_embed_tasks',              'tasks',              'task'),
      ('trg_embed_emails',             'emails',             'email'),
      ('trg_embed_email_templates',    'email_templates',    'email_template'),
      ('trg_embed_calendar_events',    'calendar_events',    'calendar_event'),
      ('trg_embed_workflows',          'workflows',          'workflow'),
      ('trg_embed_workflow_sequences', 'workflow_sequences', 'workflow_sequence'),
      ('trg_embed_crm_documents',      'crm_documents',      'crm_document'),
      ('trg_embed_agents',             'agents',             'agent'),
      ('trg_embed_boardroom_messages', 'boardroom_messages', 'boardroom_message'),
      ('trg_embed_app_notifications',  'app_notifications',  'notification')
    ) AS t(trigger_name, table_name, entity_type)
  LOOP
    -- Only create if the source table exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = r.table_name) THEN
      -- Drop existing trigger to ensure clean state
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %I',
        r.trigger_name, r.table_name
      );
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_queue_entity_embedding(%L)',
        r.trigger_name, r.table_name, r.entity_type
      );
    ELSE
      RAISE NOTICE 'Table % does not exist, skipping trigger %', r.table_name, r.trigger_name;
    END IF;
  END LOOP;
END $$;

-- ─── RPC: Lock Embedding Batch ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lock_embedding_batch(p_batch_size INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH batch AS (
    SELECT eq.id
    FROM embedding_queue eq
    WHERE eq.status = 'pending'
      AND eq.attempts < 3
    ORDER BY eq.priority DESC, eq.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE embedding_queue eq
  SET
    status = 'processing',
    processed_at = now(),
    attempts = eq.attempts + 1
  FROM batch
  WHERE eq.id = batch.id
  RETURNING eq.id, eq.entity_type, eq.entity_id;
END;
$$;

-- ─── RPC: Match Entities (vector similarity) ─────────────────────────────────

-- Note: This function requires the vector extension
-- Only create if vector type exists and embedding column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    WHERE t.typname = 'vector'
    AND a.attrelid = 'entity_embeddings'::regclass
    AND a.attname = 'embedding'
  ) THEN
    CREATE OR REPLACE FUNCTION match_entities(
      query_embedding vector(768),
      match_threshold FLOAT DEFAULT 0.3,
      match_count INT DEFAULT 10,
      filter_entity_types TEXT[] DEFAULT NULL
    )
    RETURNS TABLE (
      id UUID,
      entity_type TEXT,
      entity_id UUID,
      content_text TEXT,
      metadata JSONB,
      similarity FLOAT
    )
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        ee.id,
        ee.entity_type,
        ee.entity_id,
        ee.content_text,
        ee.metadata,
        (1 - (ee.embedding <=> query_embedding))::FLOAT AS similarity
      FROM entity_embeddings ee
      WHERE
        ee.embedding IS NOT NULL
        AND (filter_entity_types IS NULL OR ee.entity_type = ANY(filter_entity_types))
        AND (1 - (ee.embedding <=> query_embedding)) > match_threshold
      ORDER BY ee.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $func$;
    RAISE NOTICE 'Created match_entities function';
  ELSE
    RAISE NOTICE 'Vector type or embedding column not available, skipping match_entities function creation';
  END IF;
END $$;

-- ─── RPC: Hybrid Search Entities (vector + keyword) ──────────────────────────

-- Only create if vector type exists and embedding column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    WHERE t.typname = 'vector'
    AND a.attrelid = 'entity_embeddings'::regclass
    AND a.attname = 'embedding'
  ) THEN
    CREATE OR REPLACE FUNCTION hybrid_search_entities(
      query_text TEXT,
      query_embedding vector(768),
      match_threshold FLOAT DEFAULT 0.2,
      match_count INT DEFAULT 10,
      filter_entity_types TEXT[] DEFAULT NULL,
      keyword_weight FLOAT DEFAULT 0.3
    )
    RETURNS TABLE (
      id UUID,
      entity_type TEXT,
      entity_id UUID,
      content_text TEXT,
      metadata JSONB,
      similarity FLOAT
    )
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      RETURN QUERY
      SELECT
        ee.id,
        ee.entity_type,
        ee.entity_id,
        ee.content_text,
        ee.metadata,
        (
          (1.0 - keyword_weight) * (1 - (ee.embedding <=> query_embedding))
          + keyword_weight * similarity(ee.content_text, query_text)
        )::FLOAT AS similarity
      FROM entity_embeddings ee
      WHERE
        ee.embedding IS NOT NULL
        AND (filter_entity_types IS NULL OR ee.entity_type = ANY(filter_entity_types))
        AND (
          (1.0 - keyword_weight) * (1 - (ee.embedding <=> query_embedding))
          + keyword_weight * similarity(ee.content_text, query_text)
        ) > match_threshold
      ORDER BY similarity DESC
      LIMIT match_count;
    END;
    $func$;
    RAISE NOTICE 'Created hybrid_search_entities function';
  ELSE
    RAISE NOTICE 'Vector type or embedding column not available, skipping hybrid_search_entities function creation';
  END IF;
END $$;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_embeddings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'embedding_queue' AND policyname = 'Allow all on embedding_queue') THEN
    CREATE POLICY "Allow all on embedding_queue" ON embedding_queue FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'entity_embeddings' AND policyname = 'Allow all on entity_embeddings') THEN
    CREATE POLICY "Allow all on entity_embeddings" ON entity_embeddings FOR ALL USING (true);
  END IF;
END $$;

-- ─── Realtime Publication ─────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE embedding_queue;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
