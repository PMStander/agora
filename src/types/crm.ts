// ─── CRM Types ──────────────────────────────────────────────────────────────

export type LifecycleStatus =
  | 'subscriber'
  | 'lead'
  | 'marketing_qualified'
  | 'sales_qualified'
  | 'opportunity'
  | 'customer'
  | 'evangelist'
  | 'churned'
  | 'other';

export type DealStatus = 'open' | 'won' | 'lost' | 'abandoned';

export type LeadScoreLabel = 'cold' | 'warm' | 'hot';

export type CrmEntityType = 'contact' | 'company' | 'deal' | 'quote' | 'invoice' | 'project';

export type InteractionType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'note'
  | 'task'
  | 'sms'
  | 'chat'
  | 'other';

export type InteractionDirection = 'inbound' | 'outbound';

export type CompanySizeCategory =
  | 'solo'
  | 'micro'
  | 'small'
  | 'medium'
  | 'large'
  | 'enterprise';

// ─── Entities ───────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size_category: CompanySizeCategory | null;
  website: string | null;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  owner_agent_id: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  notes: string | null;
  annual_revenue: number | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  company_id: string | null;
  job_title: string | null;
  lifecycle_status: LifecycleStatus;
  lead_source: string | null;
  owner_agent_id: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  notes: string | null;
  lead_score: number;
  lead_score_label: LeadScoreLabel;
  lead_score_updated_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  display_order: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
}

export interface DealPipeline {
  id: string;
  name: string;
  is_default: boolean;
  stages: PipelineStage[];
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  title: string;
  description: string | null;
  pipeline_id: string;
  stage_id: string;
  amount: number | null;
  currency: string;
  contact_id: string | null;
  company_id: string | null;
  owner_agent_id: string | null;
  status: DealStatus;
  close_date: string | null;
  lost_reason: string | null;
  project_id: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface CrmInteraction {
  id: string;
  interaction_type: InteractionType;
  subject: string | null;
  body: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  order_id: string | null;
  agent_id: string | null;
  direction: InteractionDirection | null;
  duration_minutes: number | null;
  scheduled_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Pipeline Column Definitions (for Kanban) ───────────────────────────────

export interface PipelineColumnDef {
  id: string;
  title: string;
  color: string;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
}

// ─── Lifecycle Status Labels ────────────────────────────────────────────────

export const LIFECYCLE_STATUS_CONFIG: Record<LifecycleStatus, { label: string; color: string }> = {
  subscriber: { label: 'Subscriber', color: 'zinc' },
  lead: { label: 'Lead', color: 'blue' },
  marketing_qualified: { label: 'MQL', color: 'cyan' },
  sales_qualified: { label: 'SQL', color: 'indigo' },
  opportunity: { label: 'Opportunity', color: 'amber' },
  customer: { label: 'Customer', color: 'green' },
  evangelist: { label: 'Evangelist', color: 'purple' },
  churned: { label: 'Churned', color: 'red' },
  other: { label: 'Other', color: 'zinc' },
};

export const DEAL_STATUS_CONFIG: Record<DealStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'blue' },
  won: { label: 'Won', color: 'green' },
  lost: { label: 'Lost', color: 'red' },
  abandoned: { label: 'Abandoned', color: 'zinc' },
};

// ─── Lead Scoring ────────────────────────────────────────────────────────

export interface LeadScoringRule {
  id: string;
  type: 'field_value' | 'field_exists' | 'has_deal' | 'interaction_count_30d' | 'last_interaction_within';
  field?: string;
  operator?: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value?: string | number | boolean;
  points: number;
  label: string;
}

export interface LeadScoringModel {
  id: string;
  name: string;
  is_active: boolean;
  rules: LeadScoringRule[];
  score_thresholds: { hot: number; warm: number; cold: number };
  created_at: string;
  updated_at: string;
}

export interface LeadScoreHistoryEntry {
  id: string;
  contact_id: string;
  score: number;
  label: string;
  source: 'auto' | 'manual' | 'agent';
  model_id: string | null;
  breakdown: Record<string, number>;
  agent_id: string | null;
  created_at: string;
}

export const LEAD_SCORE_CONFIG: Record<LeadScoreLabel, { label: string; color: string; bgClass: string; textClass: string }> = {
  hot: { label: 'Hot', color: 'red', bgClass: 'bg-red-500/20', textClass: 'text-red-400' },
  warm: { label: 'Warm', color: 'orange', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400' },
  cold: { label: 'Cold', color: 'blue', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400' },
};

export const INTERACTION_TYPE_CONFIG: Record<InteractionType, { label: string; emoji: string }> = {
  call: { label: 'Call', emoji: '📞' },
  email: { label: 'Email', emoji: '📧' },
  meeting: { label: 'Meeting', emoji: '🤝' },
  note: { label: 'Note', emoji: '📝' },
  task: { label: 'Task', emoji: '✅' },
  sms: { label: 'SMS', emoji: '💬' },
  chat: { label: 'Chat', emoji: '🗨️' },
  other: { label: 'Other', emoji: '📌' },
};

// ─── Saved Views ──────────────────────────────────────────────────────────

export type SavedViewEntityType = 'contacts' | 'companies' | 'deals';

/** Shape of the filters JSONB stored in crm_saved_views */
export interface ViewFilters {
  lifecycleStatus?: LifecycleStatus | 'all';
  dealStatus?: DealStatus | 'all';
  ownerAgent?: string | null;
  tags?: string[];
  searchQuery?: string;
}

export interface SavedView {
  id: string;
  name: string;
  entity_type: SavedViewEntityType;
  filters: ViewFilters;
  sort_field: string | null;
  sort_direction: 'asc' | 'desc';
  is_default: boolean;
  is_pinned: boolean;
  icon: string | null;
  color: string | null;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export const SAVED_VIEW_ICONS = [
  '🔥', '⭐', '💎', '🎯', '📈', '🏆', '💰', '🚀',
  '📊', '🔔', '💼', '🌟', '❤️', '⚡', '🎪', '📌',
];

export const SAVED_VIEW_COLORS: { value: string; label: string; bg: string; text: string }[] = [
  { value: 'amber', label: 'Amber', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  { value: 'green', label: 'Green', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  { value: 'red', label: 'Red', bg: 'bg-red-500/20', text: 'text-red-400' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  { value: 'cyan', label: 'Cyan', bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-500/20', text: 'text-pink-400' },
  { value: 'zinc', label: 'Gray', bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
];
