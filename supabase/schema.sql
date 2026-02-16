-- Mission Control Schema for Agora
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('personal', 'business')),
  session_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'blocked')),
  current_task_id UUID,
  avatar_url TEXT,
  domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('inbox', 'assigned', 'in_progress', 'review', 'done', 'blocked')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  team TEXT CHECK (team IN ('personal', 'business')),
  domains TEXT[] DEFAULT '{}',
  created_by TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to agents after tasks table exists
ALTER TABLE agents 
  ADD CONSTRAINT fk_agents_current_task 
  FOREIGN KEY (current_task_id) 
  REFERENCES tasks(id) 
  ON DELETE SET NULL;

-- Task assignees (many-to-many)
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, agent_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_user BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  attachments UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'deliverable' CHECK (type IN ('deliverable', 'research', 'protocol', 'note')),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'mention' CHECK (type IN ('mention', 'assignment', 'status_change')),
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - restrict later if needed)
CREATE POLICY "Allow all on agents" ON agents FOR ALL USING (true);
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all on task_assignees" ON task_assignees FOR ALL USING (true);
CREATE POLICY "Allow all on comments" ON comments FOR ALL USING (true);
CREATE POLICY "Allow all on activities" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all on documents" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true);

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Indexes for performance
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_team ON tasks(team);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_notifications_agent_delivered ON notifications(agent_id, delivered);

-- Seed agents data
INSERT INTO agents (name, role, team, session_key, domains) VALUES
-- Personal Team (Philosophers)
('Marcus Aurelius', 'Main Orchestrator', 'personal', 'agent:marcus:main', ARRAY['orchestration', 'life-coaching', 'decision-making']),
('Hippocrates', 'Health & Fitness', 'personal', 'agent:hippocrates:main', ARRAY['health', 'fitness', 'wellness']),
('Confucius', 'Family & Relationships', 'personal', 'agent:confucius:main', ARRAY['family', 'relationships', 'wisdom']),
('Seneca', 'Personal Finance', 'personal', 'agent:seneca:main', ARRAY['personal-finance', 'investing', 'budgeting']),
('Archimedes', 'Tech Enthusiast', 'personal', 'agent:archimedes:main', ARRAY['tech', 'gadgets', 'home-automation']),
-- Business Team (Warriors)
('Leonidas', 'CEO', 'business', 'agent:leonidas:main', ARRAY['strategy', 'leadership', 'business-decisions']),
('Odysseus', 'CFO', 'business', 'agent:odysseus:main', ARRAY['business-finance', 'accounting', 'forecasting']),
('Spartacus', 'HR', 'business', 'agent:spartacus:main', ARRAY['hiring', 'hr', 'team-management']),
('Achilles', 'CTO', 'business', 'agent:achilles:main', ARRAY['code', 'architecture', 'devops', 'engineering']),
('Alexander', 'Marketing Head', 'business', 'agent:alexander:main', ARRAY['marketing', 'seo', 'content', 'social-media'])
ON CONFLICT (session_key) DO NOTHING;

-- Mission lifecycle tables/columns (statement -> plan -> tasks) ----------------

CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'assigned', 'in_progress', 'pending_review', 'revision', 'done', 'failed')),
  mission_status TEXT DEFAULT 'scheduled' CHECK (mission_status IN ('scheduled', 'assigned', 'in_progress', 'pending_review', 'revision', 'done', 'failed')),
  mission_phase TEXT DEFAULT 'statement' CHECK (mission_phase IN ('statement', 'plan', 'tasks')),
  mission_phase_status TEXT DEFAULT 'awaiting_approval' CHECK (mission_phase_status IN ('draft', 'awaiting_approval', 'approved')),
  mission_statement TEXT,
  mission_plan TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  agent_id TEXT NOT NULL,
  input_text TEXT,
  input_media JSONB DEFAULT '[]'::jsonb,
  review_enabled BOOLEAN DEFAULT FALSE,
  review_agent_id TEXT,
  output_text TEXT,
  output_media JSONB DEFAULT '[]'::jsonb,
  parent_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  revision_round INTEGER DEFAULT 0,
  max_revisions INTEGER DEFAULT 1,
  review_notes TEXT,
  created_by TEXT DEFAULT 'user',
  session_key TEXT,
  domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  agent_id TEXT,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_statement TEXT;
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_plan TEXT;
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_phase TEXT DEFAULT 'statement';
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_phase_status TEXT DEFAULT 'awaiting_approval';
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS mission_status TEXT DEFAULT 'scheduled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_mission_phase_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_mission_phase_check
      CHECK (mission_phase IN ('statement', 'plan', 'tasks')) NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_mission_phase_status_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_mission_phase_status_check
      CHECK (mission_phase_status IN ('draft', 'awaiting_approval', 'approved')) NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'missions_mission_status_check'
  ) THEN
    ALTER TABLE missions
      ADD CONSTRAINT missions_mission_status_check
      CHECK (mission_status IN ('scheduled', 'assigned', 'in_progress', 'pending_review', 'revision', 'done', 'failed')) NOT VALID;
  END IF;
END
$$;

UPDATE missions
SET mission_status = status
WHERE mission_status IS NULL;

UPDATE missions
SET mission_phase = 'tasks'
WHERE mission_phase IS NULL;

UPDATE missions
SET mission_phase_status = 'approved'
WHERE mission_phase_status IS NULL;

ALTER TABLE IF EXISTS missions ALTER COLUMN mission_status SET DEFAULT 'scheduled';
ALTER TABLE IF EXISTS missions ALTER COLUMN mission_phase SET DEFAULT 'statement';
ALTER TABLE IF EXISTS missions ALTER COLUMN mission_phase_status SET DEFAULT 'awaiting_approval';

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

ALTER TABLE IF EXISTS task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mission_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'missions' AND policyname = 'Allow all on missions'
  ) THEN
    CREATE POLICY "Allow all on missions" ON missions FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mission_logs' AND policyname = 'Allow all on mission_logs'
  ) THEN
    CREATE POLICY "Allow all on mission_logs" ON mission_logs FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_dependencies' AND policyname = 'Allow all on task_dependencies'
  ) THEN
    CREATE POLICY "Allow all on task_dependencies" ON task_dependencies FOR ALL USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE missions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mission_logs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_missions_phase ON missions(mission_phase, mission_phase_status);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(mission_status);
CREATE INDEX IF NOT EXISTS idx_mission_logs_mission_id ON mission_logs(mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- CRM Tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size_category TEXT CHECK (size_category IN ('solo', 'micro', 'small', 'medium', 'large', 'enterprise')),
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
    CHECK (lifecycle_status IN ('subscriber', 'lead', 'marketing_qualified', 'sales_qualified', 'opportunity', 'customer', 'evangelist', 'churned', 'other')),
  lead_source TEXT,
  owner_agent_id TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_type TEXT NOT NULL
    CHECK (interaction_type IN ('call', 'email', 'meeting', 'note', 'task', 'sms', 'chat', 'other')),
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

-- Link missions to CRM contacts
ALTER TABLE IF EXISTS missions ADD COLUMN IF NOT EXISTS contact_id UUID;

-- CRM Indexes
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_owner ON companies(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle ON contacts(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id, display_order);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact ON crm_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_deal ON crm_interactions(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_type ON crm_interactions(interaction_type);

-- CRM RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow all on companies') THEN CREATE POLICY "Allow all on companies" ON companies FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Allow all on contacts') THEN CREATE POLICY "Allow all on contacts" ON contacts FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deal_pipelines' AND policyname = 'Allow all on deal_pipelines') THEN CREATE POLICY "Allow all on deal_pipelines" ON deal_pipelines FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pipeline_stages' AND policyname = 'Allow all on pipeline_stages') THEN CREATE POLICY "Allow all on pipeline_stages" ON pipeline_stages FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deals' AND policyname = 'Allow all on deals') THEN CREATE POLICY "Allow all on deals" ON deals FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_interactions' AND policyname = 'Allow all on crm_interactions') THEN CREATE POLICY "Allow all on crm_interactions" ON crm_interactions FOR ALL USING (true); END IF; END $$;

-- CRM Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contacts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE companies; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE deals; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE crm_interactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default sales pipeline
INSERT INTO deal_pipelines (name, is_default) VALUES ('Sales Pipeline', true)
  ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (pipeline_id, name, display_order, probability, is_won, is_lost)
SELECT id, 'Discovery', 0, 10.00, false, false FROM deal_pipelines WHERE is_default = true
UNION ALL SELECT id, 'Qualification', 1, 25.00, false, false FROM deal_pipelines WHERE is_default = true
UNION ALL SELECT id, 'Proposal', 2, 50.00, false, false FROM deal_pipelines WHERE is_default = true
UNION ALL SELECT id, 'Negotiation', 3, 75.00, false, false FROM deal_pipelines WHERE is_default = true
UNION ALL SELECT id, 'Closed Won', 4, 100.00, true, false FROM deal_pipelines WHERE is_default = true
UNION ALL SELECT id, 'Closed Lost', 5, 0.00, false, true FROM deal_pipelines WHERE is_default = true;

-- ============================================================================
-- PRODUCTS — Full WooCommerce-style Schema
-- ============================================================================

-- Product Categories (hierarchical)
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories(parent_id);

-- Product Tags
CREATE TABLE IF NOT EXISTS product_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product Attributes
CREATE TABLE IF NOT EXISTS product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'select' CHECK (type IN ('select', 'text', 'color_swatch')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product Attribute Terms
CREATE TABLE IF NOT EXISTS product_attribute_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attribute_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_product_attribute_terms_attribute ON product_attribute_terms(attribute_id);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT UNIQUE,
  description TEXT,
  short_description TEXT,
  product_type TEXT NOT NULL DEFAULT 'simple'
    CHECK (product_type IN ('simple', 'variable', 'grouped', 'external')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  regular_price NUMERIC(15,2),
  sale_price NUMERIC(15,2),
  sale_price_from TIMESTAMPTZ,
  sale_price_to TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_status TEXT NOT NULL DEFAULT 'taxable'
    CHECK (tax_status IN ('taxable', 'shipping_only', 'none')),
  tax_class TEXT,
  manage_stock BOOLEAN NOT NULL DEFAULT false,
  stock_quantity INT,
  stock_status TEXT NOT NULL DEFAULT 'instock'
    CHECK (stock_status IN ('instock', 'outofstock', 'onbackorder')),
  backorders_allowed BOOLEAN NOT NULL DEFAULT false,
  low_stock_threshold INT,
  sold_individually BOOLEAN NOT NULL DEFAULT false,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC(10,3),
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  shipping_class TEXT,
  external_url TEXT,
  button_text TEXT,
  parent_id UUID REFERENCES products(id) ON DELETE SET NULL,
  featured_image_url TEXT,
  gallery_image_urls TEXT[] NOT NULL DEFAULT '{}',
  downloads JSONB NOT NULL DEFAULT '[]',
  download_limit INT DEFAULT -1,
  download_expiry_days INT DEFAULT -1,
  menu_order INT NOT NULL DEFAULT 0,
  purchase_note TEXT,
  catalog_visibility TEXT NOT NULL DEFAULT 'visible'
    CHECK (catalog_visibility IN ('visible', 'catalog', 'search', 'hidden')),
  custom_fields JSONB NOT NULL DEFAULT '{}',
  reviews_allowed BOOLEAN NOT NULL DEFAULT true,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_id);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- Product Variations
CREATE TABLE IF NOT EXISTS product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  description TEXT,
  regular_price NUMERIC(15,2),
  sale_price NUMERIC(15,2),
  sale_price_from TIMESTAMPTZ,
  sale_price_to TIMESTAMPTZ,
  manage_stock BOOLEAN NOT NULL DEFAULT false,
  stock_quantity INT,
  stock_status TEXT NOT NULL DEFAULT 'instock'
    CHECK (stock_status IN ('instock', 'outofstock', 'onbackorder')),
  backorders_allowed BOOLEAN NOT NULL DEFAULT false,
  attributes JSONB NOT NULL DEFAULT '{}',
  weight NUMERIC(10,3),
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  shipping_class TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  downloads JSONB NOT NULL DEFAULT '[]',
  image_url TEXT,
  menu_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variations_product ON product_variations(product_id);

-- Junction Tables
CREATE TABLE IF NOT EXISTS product_category_map (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS product_tag_map (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE IF NOT EXISTS product_attribute_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES product_attributes(id) ON DELETE CASCADE,
  term_ids UUID[] NOT NULL DEFAULT '{}',
  is_used_for_variations BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(product_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_product_attribute_map_product ON product_attribute_map(product_id);

CREATE TABLE IF NOT EXISTS grouped_product_members (
  group_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, member_id)
);

-- Products RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tag_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_attribute_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE grouped_product_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'Allow all on product_categories') THEN CREATE POLICY "Allow all on product_categories" ON product_categories FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_tags' AND policyname = 'Allow all on product_tags') THEN CREATE POLICY "Allow all on product_tags" ON product_tags FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_attributes' AND policyname = 'Allow all on product_attributes') THEN CREATE POLICY "Allow all on product_attributes" ON product_attributes FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_attribute_terms' AND policyname = 'Allow all on product_attribute_terms') THEN CREATE POLICY "Allow all on product_attribute_terms" ON product_attribute_terms FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow all on products') THEN CREATE POLICY "Allow all on products" ON products FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variations' AND policyname = 'Allow all on product_variations') THEN CREATE POLICY "Allow all on product_variations" ON product_variations FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_category_map' AND policyname = 'Allow all on product_category_map') THEN CREATE POLICY "Allow all on product_category_map" ON product_category_map FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_tag_map' AND policyname = 'Allow all on product_tag_map') THEN CREATE POLICY "Allow all on product_tag_map" ON product_tag_map FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_attribute_map' AND policyname = 'Allow all on product_attribute_map') THEN CREATE POLICY "Allow all on product_attribute_map" ON product_attribute_map FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grouped_product_members' AND policyname = 'Allow all on grouped_product_members') THEN CREATE POLICY "Allow all on grouped_product_members" ON grouped_product_members FOR ALL USING (true); END IF; END $$;

-- Products Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE products; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE product_variations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE product_categories; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default category
INSERT INTO product_categories (name, slug, description, display_order) VALUES
  ('Uncategorized', 'uncategorized', 'Default category', 0)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  order_type TEXT NOT NULL DEFAULT 'order'
    CHECK (order_type IN ('order', 'quote', 'invoice')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded', 'failed', 'draft')),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  shipping_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_address JSONB NOT NULL DEFAULT '{}',
  shipping_address JSONB NOT NULL DEFAULT '{}',
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'partially_paid', 'refunded')),
  customer_note TEXT,
  internal_note TEXT,
  owner_agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_contact ON orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_deal ON orders(deal_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  attributes JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_line_items_order ON order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_product ON order_line_items(product_id);

CREATE TABLE IF NOT EXISTS deal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) GENERATED ALWAYS AS (
    quantity * unit_price * (1 - discount_percent / 100)
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_products_deal ON deal_products(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_products_product ON deal_products(product_id);

-- Orders RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Allow all on orders') THEN CREATE POLICY "Allow all on orders" ON orders FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_line_items' AND policyname = 'Allow all on order_line_items') THEN CREATE POLICY "Allow all on order_line_items" ON order_line_items FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deal_products' AND policyname = 'Allow all on deal_products') THEN CREATE POLICY "Allow all on deal_products" ON deal_products FOR ALL USING (true); END IF; END $$;

-- Orders Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE orders; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE order_line_items; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  owner_agent_id TEXT,
  budget NUMERIC(15,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  custom_fields JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_deal ON projects(deal_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact ON projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);

-- Project ↔ Mission junction
CREATE TABLE IF NOT EXISTS project_missions (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_project_missions_mission ON project_missions(mission_id);

-- Deferred FK: deals.project_id → projects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_deals_project') THEN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_missions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Allow all on projects') THEN CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_missions' AND policyname = 'Allow all on project_missions') THEN CREATE POLICY "Allow all on project_missions" ON project_missions FOR ALL USING (true); END IF; END $$;

-- Projects Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE projects; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_missions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- CRM AGENT ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_agent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('contact', 'company', 'deal', 'project', 'order')),
  entity_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'collaborator', 'watcher')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_agent_assignments_agent ON crm_agent_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_crm_agent_assignments_entity ON crm_agent_assignments(entity_type, entity_id);

ALTER TABLE crm_agent_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_agent_assignments' AND policyname = 'Allow all on crm_agent_assignments') THEN CREATE POLICY "Allow all on crm_agent_assignments" ON crm_agent_assignments FOR ALL USING (true); END IF; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE crm_agent_assignments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- PROJECT AGENT SKILLS
-- ============================================================================

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

ALTER TABLE project_agent_skills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_agent_skills' AND policyname = 'Allow all on project_agent_skills') THEN CREATE POLICY "Allow all on project_agent_skills" ON project_agent_skills FOR ALL USING (true); END IF; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_agent_skills; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- PROJECT CODEBASES
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_codebases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'local'
    CHECK (source_type IN ('local', 'github', 'gitlab', 'bitbucket', 'url')),
  path TEXT NOT NULL,
  branch TEXT,
  description TEXT,
  local_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE project_codebases ADD COLUMN IF NOT EXISTS local_path TEXT;

CREATE INDEX IF NOT EXISTS idx_project_codebases_project ON project_codebases(project_id);

ALTER TABLE project_codebases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_codebases' AND policyname = 'Allow all on project_codebases') THEN CREATE POLICY "Allow all on project_codebases" ON project_codebases FOR ALL USING (true); END IF; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_codebases; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- AGENT MANAGEMENT (Hiring/SOUL, Leveling, Reviews, Context)
-- ============================================================================

-- ─── Agent Table Extensions ─────────────────────────────────────────────────

ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul JSONB DEFAULT '{}'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_version INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'anthropic';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'claude-sonnet-4-5-20250929';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'available';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS total_missions_completed INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avg_quality_score NUMERIC(3,2) DEFAULT 0.00;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS response_time_avg_minutes NUMERIC(8,2) DEFAULT 0.00;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_lifecycle_status_check') THEN
    ALTER TABLE agents ADD CONSTRAINT agents_lifecycle_status_check
      CHECK (lifecycle_status IN ('candidate', 'onboarding', 'active', 'suspended', 'retired')) NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_created_by_check') THEN
    ALTER TABLE agents ADD CONSTRAINT agents_created_by_check
      CHECK (created_by IN ('user', 'system', 'ai_suggested')) NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_availability_check') THEN
    ALTER TABLE agents ADD CONSTRAINT agents_availability_check
      CHECK (availability IN ('available', 'busy', 'offline')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agents_lifecycle ON agents(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_agents_availability ON agents(availability);
CREATE INDEX IF NOT EXISTS idx_agents_level ON agents(level);
CREATE INDEX IF NOT EXISTS idx_agents_domains ON agents USING GIN(domains);
CREATE INDEX IF NOT EXISTS idx_agents_skills ON agents USING GIN(skills);

-- ─── Agent Soul History ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_soul_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  soul JSONB NOT NULL,
  changed_by TEXT DEFAULT 'user',
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_soul_history_agent ON agent_soul_history(agent_id, version DESC);

-- ─── Agent Leveling Framework ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_levels (
  agent_id TEXT PRIMARY KEY,
  current_level SMALLINT NOT NULL DEFAULT 1
    CHECK (current_level BETWEEN 1 AND 4),
  guardrails JSONB NOT NULL DEFAULT '{
    "allowed_domains": [],
    "allowed_actions": [],
    "denied_actions": [],
    "max_concurrent_missions": 1,
    "max_daily_tasks": 5,
    "escalation_agent_id": null,
    "auto_review_threshold": 0.7
  }'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{
    "tasks_completed": 0,
    "avg_review_score": 0,
    "violations_30d": 0,
    "critical_violations_7d": 0,
    "consecutive_failures": 0,
    "time_in_level_days": 0
  }'::jsonb,
  level_assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  from_level SMALLINT NOT NULL CHECK (from_level BETWEEN 1 AND 4),
  to_level SMALLINT NOT NULL CHECK (to_level BETWEEN 1 AND 4),
  trigger TEXT NOT NULL CHECK (trigger IN ('promotion', 'demotion', 'manual_override')),
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL CHECK (approved_by IN ('system', 'human')),
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_level_history_agent
  ON agent_level_history(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_level_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  from_level SMALLINT NOT NULL CHECK (from_level BETWEEN 1 AND 4),
  to_level SMALLINT NOT NULL CHECK (to_level BETWEEN 1 AND 4),
  trigger TEXT NOT NULL CHECK (trigger IN ('promotion', 'demotion', 'manual_override')),
  reason TEXT NOT NULL,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_level_transitions_agent
  ON agent_level_transitions(agent_id, status);

CREATE TABLE IF NOT EXISTS guardrail_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  action_attempted TEXT NOT NULL,
  guardrail_violated TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  resolution TEXT NOT NULL DEFAULT 'auto_denied'
    CHECK (resolution IN ('auto_denied', 'escalated', 'human_overridden', 'approved')),
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_violations_agent
  ON guardrail_violations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_violations_severity
  ON guardrail_violations(severity, created_at DESC);

-- ─── Performance Review Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'monthly'
    CHECK (cadence IN ('weekly', 'monthly', 'quarterly')),
  next_review_at TIMESTAMPTZ NOT NULL,
  milestone_threshold INTEGER,
  quality_alert_threshold NUMERIC(3,2),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_schedules_agent ON review_schedules(agent_id);
CREATE INDEX IF NOT EXISTS idx_review_schedules_next ON review_schedules(next_review_at)
  WHERE enabled = true;

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'milestone', 'alert')),
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'narrative_ready', 'user_review', 'finalized')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative TEXT,
  ratings JSONB,
  user_notes TEXT,
  level_recommendation TEXT CHECK (level_recommendation IN ('maintain', 'promote', 'demote')),
  level_justification TEXT,
  agent_feedback TEXT,
  level_change_applied BOOLEAN NOT NULL DEFAULT false,
  previous_level INTEGER,
  new_level INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_performance_reviews_agent ON performance_reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_status ON performance_reviews(status);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_period ON performance_reviews(period_start, period_end);

CREATE TABLE IF NOT EXISTS level_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  review_id UUID REFERENCES performance_reviews(id) ON DELETE SET NULL,
  previous_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('review_promotion', 'review_demotion', 'initial_hire', 'manual_adjustment')),
  justification TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_changes_agent ON level_changes(agent_id);
CREATE INDEX IF NOT EXISTS idx_level_changes_review ON level_changes(review_id);

CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  review_id UUID REFERENCES performance_reviews(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('review_summary', 'praise', 'improvement_area', 'directive')),
  content TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent ON agent_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_review ON agent_feedback(review_id);

-- ─── Shared Context Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  title TEXT NOT NULL,
  last_updated_by_agent_id TEXT NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_contexts_project ON project_contexts(project_id);

CREATE TABLE IF NOT EXISTS context_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_context_id UUID NOT NULL REFERENCES project_contexts(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'read'
    CHECK (access_level IN ('read', 'write', 'admin')),
  granted_by TEXT NOT NULL DEFAULT 'user',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_context_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_context_access_agent ON context_access(agent_id);
CREATE INDEX IF NOT EXISTS idx_context_access_project ON context_access(project_context_id);

CREATE TABLE IF NOT EXISTS context_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_context_id UUID NOT NULL REFERENCES project_contexts(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'context'
    CHECK (doc_type IN ('access', 'context', 'research', 'decision_log')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  last_updated_by_agent_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_documents_project ON context_documents(project_context_id);
CREATE INDEX IF NOT EXISTS idx_context_documents_type ON context_documents(doc_type);

CREATE TABLE IF NOT EXISTS context_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_document_id UUID NOT NULL REFERENCES context_documents(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  diff_summary TEXT NOT NULL,
  content_snapshot TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_revisions_doc ON context_revisions(context_document_id, version DESC);

-- ─── Handoff Protocol ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS handoff_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  context_summary TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'accepted', 'in_progress', 'completed', 'declined', 'timed_out')),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  outcome TEXT,
  time_taken_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_requesting ON handoff_requests(requesting_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_target ON handoff_requests(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoff_requests(status);
CREATE INDEX IF NOT EXISTS idx_handoffs_task ON handoff_requests(task_id);

-- ─── Three-Tier Memory ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_agent_date ON daily_notes(agent_id, note_date DESC);

CREATE TABLE IF NOT EXISTS long_term_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('insight', 'pattern', 'preference', 'skill_learned', 'mistake_learned')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_daily_note_id UUID REFERENCES daily_notes(id) ON DELETE SET NULL,
  source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  relevance_score NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_referenced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_long_term_memories_agent ON long_term_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_category ON long_term_memories(category);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_tags ON long_term_memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_long_term_memories_relevance ON long_term_memories(relevance_score DESC);

CREATE TABLE IF NOT EXISTS cross_project_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent_id TEXT NOT NULL,
  source_project_context_id UUID REFERENCES project_contexts(id) ON DELETE SET NULL,
  insight TEXT NOT NULL,
  applicable_domains TEXT[] DEFAULT '{}',
  propagated_to UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cross_insights_agent ON cross_project_insights(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_cross_insights_domains ON cross_project_insights USING GIN(applicable_domains);

-- ─── Agent Management RLS ───────────────────────────────────────────────────

ALTER TABLE agent_soul_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_level_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_level_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_term_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_project_insights ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_soul_history' AND policyname = 'Allow all on agent_soul_history') THEN CREATE POLICY "Allow all on agent_soul_history" ON agent_soul_history FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_levels' AND policyname = 'Allow all on agent_levels') THEN CREATE POLICY "Allow all on agent_levels" ON agent_levels FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_level_history' AND policyname = 'Allow all on agent_level_history') THEN CREATE POLICY "Allow all on agent_level_history" ON agent_level_history FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_level_transitions' AND policyname = 'Allow all on agent_level_transitions') THEN CREATE POLICY "Allow all on agent_level_transitions" ON agent_level_transitions FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardrail_violations' AND policyname = 'Allow all on guardrail_violations') THEN CREATE POLICY "Allow all on guardrail_violations" ON guardrail_violations FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_schedules' AND policyname = 'Allow all on review_schedules') THEN CREATE POLICY "Allow all on review_schedules" ON review_schedules FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'performance_reviews' AND policyname = 'Allow all on performance_reviews') THEN CREATE POLICY "Allow all on performance_reviews" ON performance_reviews FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'level_changes' AND policyname = 'Allow all on level_changes') THEN CREATE POLICY "Allow all on level_changes" ON level_changes FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_feedback' AND policyname = 'Allow all on agent_feedback') THEN CREATE POLICY "Allow all on agent_feedback" ON agent_feedback FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_contexts' AND policyname = 'Allow all on project_contexts') THEN CREATE POLICY "Allow all on project_contexts" ON project_contexts FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'context_access' AND policyname = 'Allow all on context_access') THEN CREATE POLICY "Allow all on context_access" ON context_access FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'context_documents' AND policyname = 'Allow all on context_documents') THEN CREATE POLICY "Allow all on context_documents" ON context_documents FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'context_revisions' AND policyname = 'Allow all on context_revisions') THEN CREATE POLICY "Allow all on context_revisions" ON context_revisions FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'handoff_requests' AND policyname = 'Allow all on handoff_requests') THEN CREATE POLICY "Allow all on handoff_requests" ON handoff_requests FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_notes' AND policyname = 'Allow all on daily_notes') THEN CREATE POLICY "Allow all on daily_notes" ON daily_notes FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'long_term_memories' AND policyname = 'Allow all on long_term_memories') THEN CREATE POLICY "Allow all on long_term_memories" ON long_term_memories FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cross_project_insights' AND policyname = 'Allow all on cross_project_insights') THEN CREATE POLICY "Allow all on cross_project_insights" ON cross_project_insights FOR ALL USING (true); END IF; END $$;

-- Agent Management Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_levels; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE guardrail_violations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_level_transitions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE performance_reviews; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE handoff_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE context_documents; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE daily_notes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed agent levels
INSERT INTO agent_levels (agent_id, current_level, guardrails) VALUES
  ('main', 4, '{"allowed_domains": ["*"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 10, "max_daily_tasks": 50, "escalation_agent_id": null, "auto_review_threshold": 0.5}'),
  ('hippocrates', 1, '{"allowed_domains": ["fitness", "health", "nutrition"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('confucius', 1, '{"allowed_domains": ["family", "relationships"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('seneca', 1, '{"allowed_domains": ["personal-finance", "budgeting", "investing"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('archimedes', 1, '{"allowed_domains": ["technology", "gadgets", "coding"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('leonidas', 1, '{"allowed_domains": ["business-strategy", "leadership"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 2, "max_daily_tasks": 10, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('odysseus', 1, '{"allowed_domains": ["finance"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('spartacus', 1, '{"allowed_domains": ["hr", "recruitment"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('achilles', 1, '{"allowed_domains": ["tech-infrastructure", "development", "coding"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 2, "max_daily_tasks": 10, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('alexander', 1, '{"allowed_domains": ["marketing", "sales"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}')
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================================================
-- LEAD SCORING
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_scoring_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  rules JSONB NOT NULL DEFAULT '[]',
  score_thresholds JSONB NOT NULL DEFAULT '{"hot": 80, "warm": 50, "cold": 20}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score_label TEXT DEFAULT 'cold';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

-- Lead Scoring RLS
ALTER TABLE lead_scoring_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lead_scoring_models' AND policyname = 'Allow all on lead_scoring_models') THEN CREATE POLICY "Allow all on lead_scoring_models" ON lead_scoring_models FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lead_score_history' AND policyname = 'Allow all on lead_score_history') THEN CREATE POLICY "Allow all on lead_score_history" ON lead_score_history FOR ALL USING (true); END IF; END $$;

-- Lead Scoring Indexes
CREATE INDEX IF NOT EXISTS idx_lead_score_history_contact_id ON lead_score_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_score_history_created_at ON lead_score_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);

-- Lead Scoring Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE lead_scoring_models; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE lead_score_history; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- REPORTING VIEWS
-- ============================================================================

-- v_pipeline_forecast: Per-pipeline stage breakdown
CREATE OR REPLACE VIEW v_pipeline_forecast AS
SELECT
  dp.id   AS pipeline_id,
  dp.name AS pipeline_name,
  ps.id   AS stage_id,
  ps.name AS stage_name,
  ps.display_order,
  ps.probability,
  COUNT(d.id)                                          AS deal_count,
  COALESCE(SUM(d.amount), 0)                           AS total_value,
  COALESCE(SUM(d.amount * ps.probability / 100), 0)    AS weighted_value
FROM deal_pipelines dp
JOIN pipeline_stages ps ON ps.pipeline_id = dp.id
LEFT JOIN deals d
  ON d.stage_id = ps.id
  AND d.status = 'open'
GROUP BY dp.id, dp.name, ps.id, ps.name, ps.display_order, ps.probability
ORDER BY dp.name, ps.display_order;

-- v_revenue_by_month: Monthly revenue from won deals
CREATE OR REPLACE VIEW v_revenue_by_month AS
SELECT
  date_trunc('month', d.close_date)::date AS month,
  d.currency,
  COUNT(d.id)               AS deal_count,
  COALESCE(SUM(d.amount), 0) AS revenue
FROM deals d
WHERE d.status = 'won'
  AND d.close_date IS NOT NULL
GROUP BY date_trunc('month', d.close_date), d.currency
ORDER BY month DESC;

-- v_deal_conversion: Per-pipeline win/loss/open counts and win_rate
CREATE OR REPLACE VIEW v_deal_conversion AS
SELECT
  dp.id   AS pipeline_id,
  dp.name AS pipeline_name,
  COUNT(d.id) FILTER (WHERE d.status = 'won')  AS won,
  COUNT(d.id) FILTER (WHERE d.status = 'lost') AS lost,
  COUNT(d.id) FILTER (WHERE d.status = 'open') AS open,
  COUNT(d.id)                                   AS total,
  CASE
    WHEN COUNT(d.id) FILTER (WHERE d.status IN ('won', 'lost')) > 0
    THEN ROUND(
      COUNT(d.id) FILTER (WHERE d.status = 'won')::numeric
      / COUNT(d.id) FILTER (WHERE d.status IN ('won', 'lost'))
      * 100, 1
    )
    ELSE 0
  END AS win_rate
FROM deal_pipelines dp
LEFT JOIN deals d ON d.pipeline_id = dp.id
GROUP BY dp.id, dp.name;

-- v_lifecycle_funnel: Contact counts by lifecycle_status + active_30d
CREATE OR REPLACE VIEW v_lifecycle_funnel AS
SELECT
  lifecycle_status,
  COUNT(*)                                                          AS total_count,
  COUNT(*) FILTER (WHERE last_contacted_at > NOW() - INTERVAL '30 days') AS active_30d
FROM contacts
GROUP BY lifecycle_status
ORDER BY
  CASE lifecycle_status
    WHEN 'subscriber'          THEN 1
    WHEN 'lead'                THEN 2
    WHEN 'marketing_qualified' THEN 3
    WHEN 'sales_qualified'     THEN 4
    WHEN 'opportunity'         THEN 5
    WHEN 'customer'            THEN 6
    WHEN 'evangelist'          THEN 7
    WHEN 'churned'             THEN 8
    ELSE 9
  END;

-- v_agent_performance: Per-agent deals_won, total_revenue, missions_completed
CREATE OR REPLACE VIEW v_agent_performance AS
SELECT
  al.agent_id,
  COALESCE(dw.deals_won, 0)          AS deals_won,
  COALESCE(dw.total_revenue, 0)      AS total_revenue,
  COALESCE(mc.missions_completed, 0) AS missions_completed
FROM agent_levels al
LEFT JOIN (
  SELECT
    d.owner_agent_id AS agent_id,
    COUNT(*)         AS deals_won,
    SUM(d.amount)    AS total_revenue
  FROM deals d
  WHERE d.status = 'won'
  GROUP BY d.owner_agent_id
) dw ON dw.agent_id = al.agent_id
LEFT JOIN (
  SELECT
    m.agent_id,
    COUNT(*) AS missions_completed
  FROM missions m
  WHERE m.mission_status = 'done'
  GROUP BY m.agent_id
) mc ON mc.agent_id = al.agent_id
ORDER BY COALESCE(dw.deals_won, 0) DESC;

-- ============================================================================
-- WORKFLOW AUTOMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN (
      'entity_created', 'entity_updated', 'field_changed',
      'stage_changed', 'deal_won', 'deal_lost',
      'schedule', 'manual', 'webhook'
    )),
  trigger_entity TEXT
    CHECK (trigger_entity IN ('contact', 'company', 'deal', 'order', 'invoice', 'quote', 'project')),
  trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger_schedule TEXT,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_agent_id TEXT,
  run_count INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type, trigger_entity);
CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created ON workflows(created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'waiting')),
  trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step INT NOT NULL DEFAULT 0,
  steps_completed INT NOT NULL DEFAULT 0,
  steps_total INT NOT NULL DEFAULT 0,
  error_message TEXT,
  entity_type TEXT,
  entity_id UUID,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created ON workflow_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_entity ON workflow_runs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS workflow_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_sequences_status ON workflow_sequences(status);
CREATE INDEX IF NOT EXISTS idx_workflow_sequences_owner ON workflow_sequences(owner_agent_id);

-- Workflows RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_sequences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflows' AND policyname = 'Allow all on workflows') THEN CREATE POLICY "Allow all on workflows" ON workflows FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_runs' AND policyname = 'Allow all on workflow_runs') THEN CREATE POLICY "Allow all on workflow_runs" ON workflow_runs FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workflow_sequences' AND policyname = 'Allow all on workflow_sequences') THEN CREATE POLICY "Allow all on workflow_sequences" ON workflow_sequences FOR ALL USING (true); END IF; END $$;

-- Workflows Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workflows; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workflow_runs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workflow_sequences; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- QUOTES & INVOICES
-- ============================================================================

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted')),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  project_id UUID,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  valid_until TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  introduction TEXT,
  terms_and_conditions TEXT,
  customer_note TEXT,
  internal_note TEXT,
  converted_to_invoice_id UUID,
  converted_to_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  owner_agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quote Line Items
CREATE TABLE IF NOT EXISTS quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) GENERATED ALWAYS AS (
    quantity * unit_price * (1 - discount_percent / 100)
  ) STORED,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void', 'refunded')),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  project_id UUID,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  currency TEXT NOT NULL DEFAULT 'USD',
  issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT CHECK (recurring_interval IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  billing_address JSONB NOT NULL DEFAULT '{}',
  terms_and_conditions TEXT,
  customer_note TEXT,
  internal_note TEXT,
  owner_agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15,2) GENERATED ALWAYS AS (
    quantity * unit_price * (1 - discount_percent / 100)
  ) STORED,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice Payments
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deferred FK: quotes.converted_to_invoice_id -> invoices(id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_quotes_converted_invoice') THEN
    ALTER TABLE quotes ADD CONSTRAINT fk_quotes_converted_invoice
      FOREIGN KEY (converted_to_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Quotes & Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_deal ON quotes(deal_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote ON quote_line_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_product ON quote_line_items(product_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_deal ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_product ON invoice_line_items(product_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);

-- Quotes & Invoices RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'Allow all on quotes') THEN CREATE POLICY "Allow all on quotes" ON quotes FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_line_items' AND policyname = 'Allow all on quote_line_items') THEN CREATE POLICY "Allow all on quote_line_items" ON quote_line_items FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Allow all on invoices') THEN CREATE POLICY "Allow all on invoices" ON invoices FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_line_items' AND policyname = 'Allow all on invoice_line_items') THEN CREATE POLICY "Allow all on invoice_line_items" ON invoice_line_items FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_payments' AND policyname = 'Allow all on invoice_payments') THEN CREATE POLICY "Allow all on invoice_payments" ON invoice_payments FOR ALL USING (true); END IF; END $$;

-- Quotes & Invoices Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE quotes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE invoices; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE invoice_payments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- CRM DOCUMENTS -- Attach files to CRM entities
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  doc_type TEXT NOT NULL DEFAULT 'file'
    CHECK (doc_type IN ('file', 'contract', 'proposal', 'nda', 'sow', 'invoice_pdf', 'pdf', 'video', 'other')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'expired')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parent_document_id UUID REFERENCES crm_documents(id) ON DELETE SET NULL,
  owner_agent_id TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_documents_contact ON crm_documents(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_company ON crm_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_deal ON crm_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_project ON crm_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_quote ON crm_documents(quote_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_invoice ON crm_documents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_parent ON crm_documents(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_doc_type ON crm_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_crm_documents_status ON crm_documents(status);
CREATE INDEX IF NOT EXISTS idx_crm_documents_created ON crm_documents(created_at DESC);

ALTER TABLE crm_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_documents' AND policyname = 'Allow all on crm_documents') THEN CREATE POLICY "Allow all on crm_documents" ON crm_documents FOR ALL USING (true); END IF; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE crm_documents; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- PAYMENT SETTINGS & PAYMENT LINKS (PayPal Integration)
-- ============================================================================

-- Payment provider settings (client_id, mode, currency -- NOT secrets)
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('paypal', 'manual', 'bank_transfer')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider)
);

-- Payment links (PayPal orders tied to invoices)
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paypal',
  external_id TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'approved', 'completed', 'cancelled', 'expired')),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payer_email TEXT,
  payer_name TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment Indexes
CREATE INDEX IF NOT EXISTS idx_payment_links_invoice ON payment_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status);
CREATE INDEX IF NOT EXISTS idx_payment_links_external ON payment_links(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_settings_provider ON payment_settings(provider);

-- Payment RLS
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_settings' AND policyname = 'Allow all on payment_settings') THEN CREATE POLICY "Allow all on payment_settings" ON payment_settings FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_links' AND policyname = 'Allow all on payment_links') THEN CREATE POLICY "Allow all on payment_links" ON payment_links FOR ALL USING (true); END IF; END $$;

-- Payment Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payment_links; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- CALENDAR EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN ('meeting', 'call', 'task_due', 'follow_up', 'deadline', 'reminder', 'other')),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'tentative', 'cancelled', 'completed')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  recurrence_rule TEXT,
  location TEXT,
  meeting_url TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  interaction_id UUID REFERENCES crm_interactions(id) ON DELETE SET NULL,
  google_event_id TEXT,
  google_calendar_id TEXT,
  owner_agent_id TEXT,
  attendee_agent_ids TEXT[] NOT NULL DEFAULT '{}',
  reminder_minutes INTEGER[] NOT NULL DEFAULT '{15}',
  color TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendar Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact ON calendar_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_deal ON calendar_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google ON calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON calendar_events(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

-- Calendar RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar_events' AND policyname = 'Allow all on calendar_events') THEN CREATE POLICY "Allow all on calendar_events" ON calendar_events FOR ALL USING (true); END IF; END $$;

-- Calendar Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- IN-APP NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'deal_won', 'deal_lost', 'deal_stage_changed', 'new_lead', 'task_due',
    'workflow_completed', 'workflow_failed',
    'invoice_paid', 'invoice_overdue', 'quote_accepted', 'quote_declined',
    'email_received', 'mention', 'system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  link_type TEXT,
  link_id UUID,
  agent_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_is_read ON app_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created ON app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_type ON app_notifications(type);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_notifications' AND policyname = 'Allow all on app_notifications') THEN CREATE POLICY "Allow all on app_notifications" ON app_notifications FOR ALL USING (true); END IF; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- EMAIL INTEGRATION
-- ============================================================================

-- Email Accounts (Gmail, Apple Mail, SMTP)
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'apple_mail', 'smtp')),
  credentials JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  agent_id TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('sales', 'marketing', 'support', 'transactional', 'other')),
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_agent_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Emails
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'sent', 'delivered', 'opened', 'failed', 'received')),
  from_address TEXT,
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  cc_addresses TEXT[] NOT NULL DEFAULT '{}',
  bcc_addresses TEXT[] NOT NULL DEFAULT '{}',
  reply_to TEXT,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  interaction_id UUID REFERENCES crm_interactions(id) ON DELETE SET NULL,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  external_message_id TEXT,
  gmail_thread_id TEXT,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  agent_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  labels TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Indexes
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_deal ON emails(deal_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_thread ON emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(email_account_id);
CREATE INDEX IF NOT EXISTS idx_emails_created ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_external_msg ON emails(external_message_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Email RLS
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_accounts' AND policyname = 'Allow all on email_accounts') THEN CREATE POLICY "Allow all on email_accounts" ON email_accounts FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_templates' AND policyname = 'Allow all on email_templates') THEN CREATE POLICY "Allow all on email_templates" ON email_templates FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emails' AND policyname = 'Allow all on emails') THEN CREATE POLICY "Allow all on emails" ON emails FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_attachments' AND policyname = 'Allow all on email_attachments') THEN CREATE POLICY "Allow all on email_attachments" ON email_attachments FOR ALL USING (true); END IF; END $$;

-- Email Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE emails; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── CRM Saved Views ────────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS idx_crm_saved_views_entity_type ON crm_saved_views(entity_type);
CREATE INDEX IF NOT EXISTS idx_crm_saved_views_pinned ON crm_saved_views(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_crm_saved_views_default ON crm_saved_views(is_default) WHERE is_default = true;

ALTER TABLE crm_saved_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_saved_views' AND policyname = 'Allow all on crm_saved_views') THEN CREATE POLICY "Allow all on crm_saved_views" ON crm_saved_views FOR ALL USING (true); END IF; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE crm_saved_views; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
