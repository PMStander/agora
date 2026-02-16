// ─── CRM Document Types ─────────────────────────────────────────────────────

export type DocType = 'file' | 'contract' | 'proposal' | 'nda' | 'sow' | 'invoice_pdf' | 'pdf' | 'video' | 'other';

export type DocStatus = 'active' | 'archived' | 'expired';

export type DocumentEntityType = 'contact' | 'company' | 'deal' | 'project' | 'quote' | 'invoice';

export interface CrmDocument {
  id: string;
  title: string;
  description: string | null;
  doc_type: DocType;
  status: DocStatus;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  version: number;
  parent_document_id: string | null;
  owner_agent_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ─── Doc Type Config ────────────────────────────────────────────────────────

export interface DocTypeConfig {
  label: string;
  icon: string;
  color: string;
}

export const DOC_TYPE_CONFIG: Record<DocType, DocTypeConfig> = {
  file: { label: 'File', icon: '\uD83D\uDCC4', color: 'zinc' },
  contract: { label: 'Contract', icon: '\uD83D\uDCDD', color: 'blue' },
  proposal: { label: 'Proposal', icon: '\uD83D\uDCCB', color: 'amber' },
  nda: { label: 'NDA', icon: '\uD83D\uDD12', color: 'red' },
  sow: { label: 'SOW', icon: '\uD83D\uDCC5', color: 'purple' },
  invoice_pdf: { label: 'Invoice PDF', icon: '\uD83E\uDDFE', color: 'green' },
  pdf: { label: 'PDF', icon: '\uD83D\uDCC4', color: 'rose' },
  video: { label: 'Video', icon: '\uD83C\uDFAC', color: 'indigo' },
  other: { label: 'Other', icon: '\uD83D\uDCCE', color: 'zinc' },
};

export const DOC_STATUS_CONFIG: Record<DocStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'green' },
  archived: { label: 'Archived', color: 'zinc' },
  expired: { label: 'Expired', color: 'red' },
};
