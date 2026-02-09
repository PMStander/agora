// ─── Email Types ─────────────────────────────────────────────────────────────

export type EmailProvider = 'gmail' | 'apple_mail' | 'smtp';

export type EmailStatus =
  | 'draft'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'failed'
  | 'received';

export type EmailDirection = 'inbound' | 'outbound';

export type EmailCategory =
  | 'sales'
  | 'marketing'
  | 'support'
  | 'transactional'
  | 'other';

// ─── Entities ───────────────────────────────────────────────────────────────

export interface EmailAccount {
  id: string;
  email_address: string;
  display_name: string | null;
  provider: EmailProvider;
  credentials: Record<string, unknown>;
  is_default: boolean;
  agent_id: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  category: EmailCategory;
  variables: Array<{ name: string; default_value?: string }>;
  owner_agent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  thread_id: string | null;
  direction: EmailDirection;
  status: EmailStatus;
  from_address: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  reply_to: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  template_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  interaction_id: string | null;
  email_account_id: string | null;
  external_message_id: string | null;
  gmail_thread_id: string | null;
  sent_at: string | null;
  received_at: string | null;
  agent_id: string | null;
  metadata: Record<string, unknown>;
  labels: string[];
  created_at: string;
  updated_at: string;

  // Client-side enrichment
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  id: string;
  email_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string | null;
  created_at: string;
}

// ─── Status Config ──────────────────────────────────────────────────────────

export const EMAIL_STATUS_CONFIG: Record<EmailStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'zinc' },
  queued: { label: 'Queued', color: 'yellow' },
  sent: { label: 'Sent', color: 'blue' },
  delivered: { label: 'Delivered', color: 'cyan' },
  opened: { label: 'Opened', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  received: { label: 'Received', color: 'indigo' },
};

export const EMAIL_CATEGORY_CONFIG: Record<EmailCategory, { label: string }> = {
  sales: { label: 'Sales' },
  marketing: { label: 'Marketing' },
  support: { label: 'Support' },
  transactional: { label: 'Transactional' },
  other: { label: 'Other' },
};
