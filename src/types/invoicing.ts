// ─── Invoicing Types ────────────────────────────────────────────────────────

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'converted';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'refunded';

export type RecurringInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// ─── Entities ───────────────────────────────────────────────────────────────

export interface Quote {
  id: string;
  quote_number: string;
  title: string | null;
  status: QuoteStatus;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  currency: string;
  valid_until: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  version: number;
  previous_version_id: string | null;
  introduction: string | null;
  terms_and_conditions: string | null;
  customer_note: string | null;
  internal_note: string | null;
  converted_to_invoice_id: string | null;
  converted_to_order_id: string | null;
  converted_at: string | null;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;

  // Client-side enrichment
  line_items?: QuoteLineItem[];
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  product_id: string | null;
  variation_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
  tax_amount: number;
  sort_order: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  order_id: string | null;
  quote_id: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  is_recurring: boolean;
  recurring_interval: RecurringInterval | null;
  billing_address: Record<string, unknown>;
  terms_and_conditions: string | null;
  customer_note: string | null;
  internal_note: string | null;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;

  // Client-side enrichment
  line_items?: InvoiceLineItem[];
  payments?: InvoicePayment[];
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  variation_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
  tax_amount: number;
  sort_order: number;
  created_at: string;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

// ─── Status Config Objects ──────────────────────────────────────────────────

export const QUOTE_STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'zinc' },
  sent: { label: 'Sent', color: 'blue' },
  viewed: { label: 'Viewed', color: 'cyan' },
  accepted: { label: 'Accepted', color: 'green' },
  declined: { label: 'Declined', color: 'red' },
  expired: { label: 'Expired', color: 'amber' },
  converted: { label: 'Converted', color: 'purple' },
};

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'zinc' },
  sent: { label: 'Sent', color: 'blue' },
  viewed: { label: 'Viewed', color: 'cyan' },
  partially_paid: { label: 'Partial', color: 'amber' },
  paid: { label: 'Paid', color: 'green' },
  overdue: { label: 'Overdue', color: 'red' },
  void: { label: 'Void', color: 'zinc' },
  refunded: { label: 'Refunded', color: 'purple' },
};

export const RECURRING_INTERVAL_CONFIG: Record<RecurringInterval, { label: string }> = {
  weekly: { label: 'Weekly' },
  monthly: { label: 'Monthly' },
  quarterly: { label: 'Quarterly' },
  yearly: { label: 'Yearly' },
};
