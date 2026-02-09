-- ============================================================================
-- CRM Documents -- Attach files to CRM entities (contracts, proposals, NDAs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  doc_type TEXT NOT NULL DEFAULT 'file'
    CHECK (doc_type IN ('file', 'contract', 'proposal', 'nda', 'sow', 'invoice_pdf', 'other')),
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

-- Indexes on all FK columns
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

-- RLS
ALTER TABLE crm_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'crm_documents' AND policyname = 'Allow all on crm_documents'
  ) THEN
    CREATE POLICY "Allow all on crm_documents" ON crm_documents FOR ALL USING (true);
  END IF;
END $$;

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm_documents;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
