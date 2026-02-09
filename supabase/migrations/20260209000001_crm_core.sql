-- CRM Core: Companies, Contacts, Deal Pipelines, Deals, Interactions
-- Part of Phase 1: CRM for Agora

-- ─── Companies ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size_category TEXT CHECK (size_category IN (
    'solo', 'micro', 'small', 'medium', 'large', 'enterprise'
  )),
  website TEXT,
  logo_url TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  phone TEXT,
  owner_agent_id TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  annual_revenue NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_owner ON companies(owner_agent_id);
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);

-- ─── Contacts ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  job_title TEXT,
  lifecycle_status TEXT DEFAULT 'lead'
    CHECK (lifecycle_status IN (
      'subscriber', 'lead', 'marketing_qualified', 'sales_qualified',
      'opportunity', 'customer', 'evangelist', 'churned', 'other'
    )),
  lead_source TEXT,
  owner_agent_id TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_lifecycle ON contacts(lifecycle_status);
CREATE INDEX idx_contacts_owner ON contacts(owner_agent_id);
CREATE INDEX idx_contacts_created_at ON contacts(created_at DESC);

-- ─── Deal Pipelines ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deal_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES deal_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  probability NUMERIC(5,2) DEFAULT 0,
  is_won BOOLEAN DEFAULT FALSE,
  is_lost BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id, display_order);

-- ─── Deals ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  pipeline_id UUID NOT NULL REFERENCES deal_pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2),
  currency TEXT DEFAULT 'USD',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  owner_agent_id TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'abandoned')),
  close_date TIMESTAMPTZ,
  lost_reason TEXT,
  project_id UUID,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_pipeline_stage ON deals(pipeline_id, stage_id);
CREATE INDEX idx_deals_contact ON deals(contact_id);
CREATE INDEX idx_deals_company ON deals(company_id);
CREATE INDEX idx_deals_owner ON deals(owner_agent_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_close_date ON deals(close_date);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

-- ─── CRM Interactions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_type TEXT NOT NULL
    CHECK (interaction_type IN (
      'call', 'email', 'meeting', 'note', 'task', 'sms', 'chat', 'other'
    )),
  subject TEXT,
  body TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  project_id UUID,
  order_id UUID,
  agent_id TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  duration_minutes INTEGER,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_interactions_contact ON crm_interactions(contact_id);
CREATE INDEX idx_crm_interactions_company ON crm_interactions(company_id);
CREATE INDEX idx_crm_interactions_deal ON crm_interactions(deal_id);
CREATE INDEX idx_crm_interactions_type ON crm_interactions(interaction_type);
CREATE INDEX idx_crm_interactions_created_at ON crm_interactions(created_at DESC);

-- ─── Link missions to CRM contacts ─────────────────────────────────────────

ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS contact_id UUID;

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on companies" ON companies FOR ALL USING (true);
CREATE POLICY "Allow all on contacts" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all on deal_pipelines" ON deal_pipelines FOR ALL USING (true);
CREATE POLICY "Allow all on pipeline_stages" ON pipeline_stages FOR ALL USING (true);
CREATE POLICY "Allow all on deals" ON deals FOR ALL USING (true);
CREATE POLICY "Allow all on crm_interactions" ON crm_interactions FOR ALL USING (true);

-- ─── Realtime ───────────────────────────────────────────────────────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE companies;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE deals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm_interactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Seed: Default Sales Pipeline ───────────────────────────────────────────

INSERT INTO deal_pipelines (name, is_default) VALUES ('Sales Pipeline', true);

INSERT INTO pipeline_stages (pipeline_id, name, display_order, probability, is_won, is_lost) VALUES
  ((SELECT id FROM deal_pipelines WHERE is_default = true LIMIT 1), 'Discovery', 0, 10.00, false, false),
  ((SELECT id FROM deal_pipelines WHERE is_default = true LIMIT 1), 'Qualification', 1, 25.00, false, false),
  ((SELECT id FROM deal_pipelines WHERE is_default = true LIMIT 1), 'Proposal', 2, 50.00, false, false),
  ((SELECT id FROM deal_pipelines WHERE is_default = true LIMIT 1), 'Negotiation', 3, 75.00, false, false),
  ((SELECT id FROM deal_pipelines WHERE is_default = true LIMIT 1), 'Closed Won', 4, 100.00, true, false),
  ((SELECT id FROM deal_pipelines WHERE is_default = true LIMIT 1), 'Closed Lost', 5, 0.00, false, true);
