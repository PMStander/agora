-- Lead Scoring Migration
-- Adds lead scoring models, score history, and score columns on contacts

-- ─── Lead Scoring Models ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_scoring_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  rules JSONB NOT NULL DEFAULT '[]',
  score_thresholds JSONB NOT NULL DEFAULT '{"hot": 80, "warm": 50, "cold": 20}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_scoring_models ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_scoring_models' AND policyname = 'Allow all on lead_scoring_models'
  ) THEN
    CREATE POLICY "Allow all on lead_scoring_models" ON lead_scoring_models FOR ALL USING (true);
  END IF;
END $$;

-- ─── Lead Score History ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual', 'agent')),
  model_id UUID REFERENCES lead_scoring_models(id) ON DELETE SET NULL,
  breakdown JSONB NOT NULL DEFAULT '{}',
  agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_score_history' AND policyname = 'Allow all on lead_score_history'
  ) THEN
    CREATE POLICY "Allow all on lead_score_history" ON lead_score_history FOR ALL USING (true);
  END IF;
END $$;

-- ─── Add Score Columns to Contacts ──────────────────────────────────────────

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score_label TEXT DEFAULT 'cold';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lead_score_history_contact_id ON lead_score_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_created_at ON lead_score_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);

-- ─── Realtime ────────────────────────────────────────────────────────────────

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE lead_scoring_models; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE lead_score_history; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
