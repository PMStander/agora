// ─── Enums / Unions ─────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'void' | 'reconciled';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'paypal' | 'other';
export type CategoryType = 'income' | 'expense' | 'both';
export type TaxType = 'sales' | 'vat' | 'gst' | 'other';
export type CreditNoteStatus = 'draft' | 'issued' | 'applied' | 'void';

// ─── Entities ───────────────────────────────────────────────────────────────

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string;
  type: CategoryType;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  name: string;
  account_type: AccountType;
  currency: string;
  opening_balance: number;
  current_balance: number;
  institution_name: string | null;
  account_number_last4: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  country: string | null;
  region: string | null;
  tax_type: TaxType;
  is_compound: boolean;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialTransaction {
  id: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;

  // Classification
  category_id: string | null;
  bank_account_id: string | null;

  // Source linking (polymorphic)
  invoice_payment_id: string | null;
  invoice_id: string | null;
  order_id: string | null;
  deal_id: string | null;

  // Payee
  payee_name: string | null;
  payee_contact_id: string | null;
  payee_company_id: string | null;

  // Details
  description: string | null;
  reference_number: string | null;
  transaction_date: string;
  receipt_url: string | null;
  tax_amount: number;
  tax_rate_id: string | null;
  is_tax_inclusive: boolean;
  tags: string[];
  notes: string | null;

  created_at: string;
  updated_at: string;
}

export interface CreditNote {
  id: string;
  credit_note_number: string | null;
  invoice_id: string | null;
  amount: number;
  reason: string | null;
  status: CreditNoteStatus;
  issued_at: string | null;
  applied_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── View Row Types ─────────────────────────────────────────────────────────

export interface ProfitLossRow {
  month: string;
  currency: string;
  total_income: number;
  total_expenses: number;
  net_profit: number;
}

export interface ExpenseByCategoryRow {
  month: string;
  currency: string;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  category_color: string | null;
  total_amount: number;
  transaction_count: number;
}

export interface ReceivablesAgingRow {
  currency: string;
  current_amount: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
  total_outstanding: number;
}

export interface CashFlowRow {
  month: string;
  currency: string;
  cash_in: number;
  cash_out: number;
  net_cash_flow: number;
}

export interface TaxSummaryRow {
  month: string;
  currency: string;
  tax_name: string | null;
  tax_rate: number | null;
  tax_collected: number;
  tax_paid: number;
  net_tax_liability: number;
}

// ─── Status Configs ─────────────────────────────────────────────────────────

export const TRANSACTION_STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: 'amber' },
  completed:  { label: 'Completed',  color: 'green' },
  void:       { label: 'Void',       color: 'red' },
  reconciled: { label: 'Reconciled', color: 'blue' },
};

export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, { label: string; color: string; icon: string }> = {
  income:   { label: 'Income',   color: 'green',  icon: '↓' },
  expense:  { label: 'Expense',  color: 'red',    icon: '↑' },
  transfer: { label: 'Transfer', color: 'blue',   icon: '⇄' },
};

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, { label: string; icon: string }> = {
  checking:    { label: 'Checking',    icon: '🏦' },
  savings:     { label: 'Savings',     icon: '🏦' },
  cash:        { label: 'Cash',        icon: '💵' },
  credit_card: { label: 'Credit Card', icon: '💳' },
  paypal:      { label: 'PayPal',      icon: '🅿️' },
  other:       { label: 'Other',       icon: '📦' },
};
