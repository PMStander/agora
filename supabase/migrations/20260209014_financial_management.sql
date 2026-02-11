-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Financial Management Module                                                ║
-- ║  Tables: expense_categories, bank_accounts, tax_rates,                      ║
-- ║          financial_transactions, credit_notes                               ║
-- ║  Views:  v_profit_loss, v_expense_by_category, v_receivables_aging,         ║
-- ║          v_cash_flow, v_tax_summary                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ─── 1. Expense Categories ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  type        TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'both')),
  parent_id   UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  color       TEXT,
  icon        TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_slug ON expense_categories(slug);
CREATE INDEX IF NOT EXISTS idx_expense_categories_type ON expense_categories(type);
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON expense_categories(parent_id);

-- ─── 2. Bank Accounts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  account_type          TEXT NOT NULL DEFAULT 'checking'
                          CHECK (account_type IN ('checking', 'savings', 'cash', 'credit_card', 'paypal', 'other')),
  currency              TEXT NOT NULL DEFAULT 'USD',
  opening_balance       NUMERIC(15,2) NOT NULL DEFAULT 0,
  current_balance       NUMERIC(15,2) NOT NULL DEFAULT 0,
  institution_name      TEXT,
  account_number_last4  TEXT,
  is_default            BOOLEAN NOT NULL DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(account_type);

-- ─── 3. Tax Rates ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  rate        NUMERIC(7,4) NOT NULL DEFAULT 0,
  country     TEXT,
  region      TEXT,
  tax_type    TEXT NOT NULL DEFAULT 'vat' CHECK (tax_type IN ('sales', 'vat', 'gst', 'other')),
  is_compound BOOLEAN NOT NULL DEFAULT false,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates(is_active);

-- ─── 4. Financial Transactions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type      TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  status                TEXT NOT NULL DEFAULT 'completed'
                          CHECK (status IN ('pending', 'completed', 'void', 'reconciled')),
  amount                NUMERIC(15,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'USD',

  -- Classification
  category_id           UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  bank_account_id       UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,

  -- Source linking (polymorphic — at most one set)
  invoice_payment_id    UUID,
  invoice_id            UUID,
  order_id              UUID,
  deal_id               UUID,

  -- Payee (for expenses)
  payee_name            TEXT,
  payee_contact_id      UUID,
  payee_company_id      UUID,

  -- Details
  description           TEXT,
  reference_number      TEXT,
  transaction_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_url           TEXT,
  tax_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_rate_id           UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  is_tax_inclusive       BOOLEAN NOT NULL DEFAULT false,
  tags                  TEXT[],
  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_type   ON financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date   ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_cat    ON financial_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_bank   ON financial_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_inv    ON financial_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_deal   ON financial_transactions(deal_id);

-- ─── 5. Credit Notes (schema only for Phase 1) ────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number  TEXT UNIQUE,
  invoice_id          UUID,
  amount              NUMERIC(15,2) NOT NULL,
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'issued', 'applied', 'void')),
  issued_at           TIMESTAMPTZ,
  applied_at          TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status  ON credit_notes(status);

-- ─── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE expense_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes            ENABLE ROW LEVEL SECURITY;

-- Permissive policies (tighten before production)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'expense_categories',
    'bank_accounts',
    'tax_rates',
    'financial_transactions',
    'credit_notes'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Allow all %1$s" ON %1$I',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Allow all %1$s" ON %1$I FOR ALL USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END
$$;

-- ─── Realtime ───────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE expense_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE tax_rates;
ALTER PUBLICATION supabase_realtime ADD TABLE financial_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE credit_notes;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  SQL Views for Financial Reports                                            ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── v_profit_loss ──────────────────────────────────────────────────────────────
-- Monthly income vs expenses → net profit, grouped by currency

CREATE OR REPLACE VIEW v_profit_loss AS
SELECT
  date_trunc('month', transaction_date)::date  AS month,
  currency,
  COALESCE(SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
  COALESCE(SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS net_profit
FROM financial_transactions
WHERE status IN ('completed', 'reconciled')
GROUP BY date_trunc('month', transaction_date)::date, currency
ORDER BY month DESC;

-- ─── v_expense_by_category ──────────────────────────────────────────────────────
-- Monthly expense totals per category

CREATE OR REPLACE VIEW v_expense_by_category AS
SELECT
  date_trunc('month', ft.transaction_date)::date AS month,
  ft.currency,
  ft.category_id,
  ec.name       AS category_name,
  ec.slug       AS category_slug,
  ec.color      AS category_color,
  COALESCE(SUM(ft.amount), 0) AS total_amount,
  COUNT(*)      AS transaction_count
FROM financial_transactions ft
LEFT JOIN expense_categories ec ON ec.id = ft.category_id
WHERE ft.transaction_type = 'expense'
  AND ft.status IN ('completed', 'reconciled')
GROUP BY date_trunc('month', ft.transaction_date)::date, ft.currency, ft.category_id, ec.name, ec.slug, ec.color
ORDER BY month DESC, total_amount DESC;

-- ─── v_receivables_aging ────────────────────────────────────────────────────────
-- Invoice aging buckets (current, 1-30, 31-60, 61-90, 90+)

CREATE OR REPLACE VIEW v_receivables_aging AS
SELECT
  currency,
  COALESCE(SUM(CASE WHEN age_days <=  0 THEN outstanding ELSE 0 END), 0) AS current_amount,
  COALESCE(SUM(CASE WHEN age_days BETWEEN  1 AND 30 THEN outstanding ELSE 0 END), 0) AS days_1_30,
  COALESCE(SUM(CASE WHEN age_days BETWEEN 31 AND 60 THEN outstanding ELSE 0 END), 0) AS days_31_60,
  COALESCE(SUM(CASE WHEN age_days BETWEEN 61 AND 90 THEN outstanding ELSE 0 END), 0) AS days_61_90,
  COALESCE(SUM(CASE WHEN age_days >  90 THEN outstanding ELSE 0 END), 0) AS days_over_90,
  COALESCE(SUM(outstanding), 0) AS total_outstanding
FROM (
  SELECT
    currency,
    (total - amount_paid)             AS outstanding,
    EXTRACT(DAY FROM now() - due_date)::int AS age_days
  FROM invoices
  WHERE status IN ('sent', 'overdue', 'partially_paid')
    AND total > amount_paid
) sub
GROUP BY currency;

-- ─── v_cash_flow ────────────────────────────────────────────────────────────────
-- Monthly cash in vs cash out → net cash flow

CREATE OR REPLACE VIEW v_cash_flow AS
SELECT
  date_trunc('month', transaction_date)::date AS month,
  currency,
  COALESCE(SUM(CASE WHEN transaction_type = 'income'   THEN amount ELSE 0 END), 0) AS cash_in,
  COALESCE(SUM(CASE WHEN transaction_type = 'expense'  THEN amount ELSE 0 END), 0) AS cash_out,
  COALESCE(SUM(CASE WHEN transaction_type = 'income'   THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN transaction_type = 'expense'  THEN amount ELSE 0 END), 0) AS net_cash_flow
FROM financial_transactions
WHERE status IN ('completed', 'reconciled')
GROUP BY date_trunc('month', transaction_date)::date, currency
ORDER BY month DESC;

-- ─── v_tax_summary ──────────────────────────────────────────────────────────────
-- Monthly tax collected vs tax paid → net tax liability

CREATE OR REPLACE VIEW v_tax_summary AS
SELECT
  date_trunc('month', ft.transaction_date)::date AS month,
  ft.currency,
  tr.name AS tax_name,
  tr.rate AS tax_rate,
  COALESCE(SUM(CASE WHEN ft.transaction_type = 'income'  THEN ft.tax_amount ELSE 0 END), 0) AS tax_collected,
  COALESCE(SUM(CASE WHEN ft.transaction_type = 'expense' THEN ft.tax_amount ELSE 0 END), 0) AS tax_paid,
  COALESCE(SUM(CASE WHEN ft.transaction_type = 'income'  THEN ft.tax_amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN ft.transaction_type = 'expense' THEN ft.tax_amount ELSE 0 END), 0) AS net_tax_liability
FROM financial_transactions ft
LEFT JOIN tax_rates tr ON tr.id = ft.tax_rate_id
WHERE ft.tax_amount > 0
  AND ft.status IN ('completed', 'reconciled')
GROUP BY date_trunc('month', ft.transaction_date)::date, ft.currency, tr.name, tr.rate
ORDER BY month DESC;

-- ─── Seed Data ──────────────────────────────────────────────────────────────────

INSERT INTO expense_categories (name, slug, type, is_system, sort_order, color, icon)
VALUES
  ('Cost of Goods Sold', 'cogs',                'expense', true,  1, '#ef4444', 'package'),
  ('Marketing',          'marketing',            'expense', true,  2, '#f97316', 'megaphone'),
  ('Payroll',            'payroll',              'expense', true,  3, '#eab308', 'users'),
  ('Software',           'software',             'expense', true,  4, '#22c55e', 'monitor'),
  ('Rent',               'rent',                 'expense', true,  5, '#3b82f6', 'building'),
  ('Travel',             'travel',               'expense', true,  6, '#8b5cf6', 'plane'),
  ('Utilities',          'utilities',            'expense', true,  7, '#06b6d4', 'zap'),
  ('Office Supplies',    'office-supplies',       'expense', true,  8, '#ec4899', 'paperclip'),
  ('Professional Services', 'professional-services', 'expense', true,  9, '#14b8a6', 'briefcase'),
  ('Sales Revenue',      'sales-revenue',         'income',  true, 10, '#22c55e', 'dollar-sign'),
  ('Service Revenue',    'service-revenue',        'income',  true, 11, '#10b981', 'trending-up'),
  ('Other Income',       'other-income',           'income',  true, 12, '#6366f1', 'plus-circle'),
  ('Other Expense',      'other-expense',          'expense', true, 13, '#71717a', 'more-horizontal')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tax_rates (name, rate, country, tax_type, is_default, is_active)
VALUES
  ('ZAR VAT 15%',         15.0000, 'ZA', 'vat',   true,  true),
  ('US Sales Tax (0%)',     0.0000, 'US', 'sales', false, true),
  ('No Tax',                0.0000, NULL, 'other', false, true)
ON CONFLICT DO NOTHING;
