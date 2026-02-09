// ─── Payment Types ──────────────────────────────────────────────────────────

export type PaymentProvider = 'paypal' | 'manual' | 'bank_transfer';

export type PaymentLinkStatus =
  | 'created'
  | 'approved'
  | 'completed'
  | 'cancelled'
  | 'expired';

// ─── Entities ───────────────────────────────────────────────────────────────

export interface PaymentSettings {
  id: string;
  provider: PaymentProvider;
  is_active: boolean;
  config: PayPalConfig | Record<string, unknown>;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PayPalConfig {
  client_id: string;
  mode: 'sandbox' | 'live';
}

export interface PaymentLink {
  id: string;
  invoice_id: string;
  provider: string;
  external_id: string | null;
  checkout_url: string | null;
  status: PaymentLinkStatus;
  amount: number;
  currency: string;
  payer_email: string | null;
  payer_name: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Status Config ──────────────────────────────────────────────────────────

export const PAYMENT_LINK_STATUS_CONFIG: Record<
  PaymentLinkStatus,
  { label: string; color: string }
> = {
  created: { label: 'Created', color: 'zinc' },
  approved: { label: 'Approved', color: 'blue' },
  completed: { label: 'Completed', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
  expired: { label: 'Expired', color: 'amber' },
};
