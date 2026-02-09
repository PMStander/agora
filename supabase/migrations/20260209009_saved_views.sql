-- CRM Saved Views
-- Allows users to save filter combinations as named views

CREATE TABLE IF NOT EXISTS crm_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contacts', 'companies', 'deals')),
  filters JSONB NOT NULL DEFAULT '{}',
  sort_field TEXT,
  sort_direction TEXT DEFAULT 'asc' CHECK (sort_direction IN ('asc', 'desc')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  icon TEXT,
  color TEXT,
  owner_agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_saved_views_entity_type ON crm_saved_views(entity_type);
CREATE INDEX IF NOT EXISTS idx_crm_saved_views_pinned ON crm_saved_views(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_crm_saved_views_default ON crm_saved_views(is_default) WHERE is_default = true;

-- RLS
ALTER TABLE crm_saved_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_saved_views'
      AND policyname = 'Allow all on crm_saved_views'
  ) THEN
    CREATE POLICY "Allow all on crm_saved_views"
      ON crm_saved_views FOR ALL USING (true);
  END IF;
END $$;

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm_saved_views;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
