// ─── Enums / Unions ─────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'void' | 'reconciled';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card' | 'paypal' | 'other';
export type CategoryType = 'income' | 'expense' | 'both';
export type TaxType = 'sales' | 'vat' | 'gst' | 'other';
export type CreditNoteStatus = 'draft' | 'issued' | 'applied' | 'void';
export type FinancialContext = 'business' | 'personal';

// Budget types
export type BudgetPeriodType = 'monthly' | 'quarterly' | 'yearly';

// Goal types
export type GoalType = 'savings' | 'revenue' | 'expense_reduction' | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'cancelled' | 'paused';

// Recurring types
export type RecurringItemType = 'expense' | 'income' | 'retainer';
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringHistoryStatus = 'expected' | 'matched' | 'missed' | 'skipped';

// Forecast types
export type ForecastScenario = 'optimistic' | 'realistic' | 'pessimistic';

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
  context: FinancialContext | 'both';
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

  // Recurring link
  recurring_item_id: string | null;

  // Context
  context: FinancialContext;

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

// ─── Budget ─────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  category_id: string;
  period_type: BudgetPeriodType;
  period_start: string;
  amount: number;
  currency: string;
  rollover: boolean;
  rollover_amount: number;
  context: FinancialContext;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Financial Goals ────────────────────────────────────────────────────────

export interface FinancialGoal {
  id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date: string | null;
  period_type: BudgetPeriodType | null;
  status: GoalStatus;
  category_id: string | null;
  bank_account_id: string | null;
  color: string | null;
  icon: string | null;
  context: FinancialContext;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  transaction_id: string | null;
  amount: number;
  contribution_date: string;
  notes: string | null;
  created_at: string;
}

// ─── Recurring Items ────────────────────────────────────────────────────────

export interface RecurringItem {
  id: string;
  item_type: RecurringItemType;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  frequency: RecurringFrequency;
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  category_id: string | null;
  bank_account_id: string | null;
  payee_name: string | null;
  contact_id: string | null;
  company_id: string | null;
  retainer_hours: number | null;
  hourly_rate: number | null;
  auto_create_transaction: boolean;
  variance_threshold_pct: number | null;
  is_active: boolean;
  last_generated_at: string | null;
  context: FinancialContext;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringItemHistory {
  id: string;
  recurring_item_id: string;
  expected_date: string;
  expected_amount: number;
  actual_amount: number | null;
  transaction_id: string | null;
  status: RecurringHistoryStatus;
  variance_pct: number | null;
  hours_used: number | null;
  created_at: string;
}

// ─── Cash Flow Forecast (computed client-side) ──────────────────────────────

export interface ForecastMonth {
  month: string;
  recurring_income: number;
  retainer_income: number;
  pipeline_weighted: number;
  upcoming_invoices: number;
  total_projected_income: number;
  recurring_expenses: number;
  total_projected_expenses: number;
  net_projected: number;
  cumulative_balance: number;
}

// ─── View Row Types (new views) ─────────────────────────────────────────────

export interface BudgetVsActualRow {
  budget_id: string;
  category_id: string;
  category_name: string | null;
  category_color: string | null;
  period_type: BudgetPeriodType;
  period_start: string;
  budget_amount: number;
  rollover_amount: number;
  effective_budget: number;
  currency: string;
  context: FinancialContext;
  actual_spent: number;
  variance: number;
  utilization_pct: number;
}

export interface GoalProgressRow {
  goal_id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date: string | null;
  status: GoalStatus;
  category_id: string | null;
  context: FinancialContext;
  color: string | null;
  icon: string | null;
  progress_pct: number;
  daily_target: number;
  contribution_count: number;
  days_remaining: number | null;
}

// ─── Status Configs (new) ───────────────────────────────────────────────────

export const GOAL_STATUS_CONFIG: Record<GoalStatus, { label: string; color: string }> = {
  active:    { label: 'Active',    color: 'blue' },
  achieved:  { label: 'Achieved',  color: 'green' },
  cancelled: { label: 'Cancelled', color: 'zinc' },
  paused:    { label: 'Paused',    color: 'amber' },
};

export const RECURRING_TYPE_CONFIG: Record<RecurringItemType, { label: string; color: string; icon: string }> = {
  expense:  { label: 'Expense',  color: 'red',    icon: '↑' },
  income:   { label: 'Income',   color: 'green',  icon: '↓' },
  retainer: { label: 'Retainer', color: 'purple', icon: '🤝' },
};

export const FREQUENCY_CONFIG: Record<RecurringFrequency, { label: string; short: string }> = {
  weekly:    { label: 'Weekly',     short: '/wk' },
  biweekly:  { label: 'Bi-weekly',  short: '/2wk' },
  monthly:   { label: 'Monthly',    short: '/mo' },
  quarterly: { label: 'Quarterly',  short: '/qtr' },
  yearly:    { label: 'Yearly',     short: '/yr' },
};
