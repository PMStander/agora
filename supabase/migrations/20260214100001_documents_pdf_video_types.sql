-- Add 'pdf' and 'video' to crm_documents doc_type CHECK constraint
-- for agent-generated artifacts (react-pdf skill, remotion skill)

ALTER TABLE crm_documents DROP CONSTRAINT IF EXISTS crm_documents_doc_type_check;
ALTER TABLE crm_documents ADD CONSTRAINT crm_documents_doc_type_check
  CHECK (doc_type IN ('file', 'contract', 'proposal', 'nda', 'sow', 'invoice_pdf', 'pdf', 'video', 'other'));
