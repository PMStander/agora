// ─── Document Center Types ──────────────────────────────────────────────────
// Unified types that normalize documents from all sources into a single interface.

export type DocumentSource =
  | 'crm_document'
  | 'context_document'
  | 'mission_statement'
  | 'mission_plan'
  | 'boardroom_minutes';

export type DocumentCategory =
  | 'all'
  | 'mission_docs'
  | 'prds'
  | 'contracts'
  | 'meeting_minutes'
  | 'files'
  | 'decisions';

export type DocumentCenterStatus =
  | 'draft'
  | 'active'
  | 'awaiting_approval'
  | 'approved'
  | 'archived'
  | 'closed';

export type DocumentSortOption = 'newest' | 'oldest' | 'recently_updated' | 'title_asc' | 'title_desc';

// ─── Linked Entities & Contributors ─────────────────────────────────────────

export interface LinkedEntity {
  type: 'mission' | 'project' | 'contact' | 'company' | 'deal' | 'quote' | 'invoice' | 'agent' | 'boardroom_session';
  id: string;
  label: string;
}

export interface DocumentContributor {
  agentId: string;
  role: 'owner' | 'editor' | 'reviewer' | 'participant';
  lastContributedAt: string | null;
}

// ─── Unified Document Item ──────────────────────────────────────────────────

export interface DocumentCenterItem {
  id: string;
  source: DocumentSource;
  sourceId: string;

  title: string;
  contentPreview: string;
  contentType: 'markdown' | 'file' | 'synthesized';

  category: DocumentCategory;
  status: DocumentCenterStatus;

  version: number | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;

  contributors: DocumentContributor[];
  linkedEntities: LinkedEntity[];

  requiresApproval: boolean;
  approvalData: {
    phase: string;
    phaseStatus: string;
    reviewAgentId: string | null;
    reviewNotes: string | null;
  } | null;

  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface DocumentCenterFilters {
  category: DocumentCategory;
  status: DocumentCenterStatus | 'all';
  search: string;
  sort: DocumentSortOption;
  agentId: string | null;
}

export const DEFAULT_FILTERS: DocumentCenterFilters = {
  category: 'all',
  status: 'all',
  search: '',
  sort: 'newest',
  agentId: null,
};

// ─── Config ─────────────────────────────────────────────────────────────────

export interface CategoryConfig {
  id: DocumentCategory;
  label: string;
  icon: string;
  color: string;
}

export const DOCUMENT_CATEGORIES: CategoryConfig[] = [
  { id: 'all', label: 'All', icon: '📄', color: 'zinc' },
  { id: 'mission_docs', label: 'Mission Docs', icon: '🎯', color: 'amber' },
  { id: 'prds', label: 'PRDs & Research', icon: '📋', color: 'blue' },
  { id: 'contracts', label: 'Contracts & Legal', icon: '📝', color: 'purple' },
  { id: 'meeting_minutes', label: 'Minutes', icon: '🏛️', color: 'emerald' },
  { id: 'files', label: 'Files', icon: '📎', color: 'zinc' },
  { id: 'decisions', label: 'Decisions', icon: '⚖️', color: 'orange' },
];

export const DOCUMENT_STATUS_CONFIG: Record<DocumentCenterStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'zinc' },
  active: { label: 'Active', color: 'green' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'amber' },
  approved: { label: 'Approved', color: 'emerald' },
  archived: { label: 'Archived', color: 'zinc' },
  closed: { label: 'Closed', color: 'blue' },
};

export const SOURCE_LABELS: Record<DocumentSource, string> = {
  crm_document: 'CRM Document',
  context_document: 'Project Document',
  mission_statement: 'Mission Statement',
  mission_plan: 'Mission Plan',
  boardroom_minutes: 'Meeting Minutes',
};
