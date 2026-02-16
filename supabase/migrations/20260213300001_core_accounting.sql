-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Core Accounting System                                                     ║
-- ║  Tables: chart_of_accounts, journal_entries, journal_entry_lines,           ║
-- ║          fixed_assets, asset_depreciation_log, supplier_bills,              ║
-- ║          supplier_bill_line_items, supplier_bill_payments,                  ║
-- ║          purchase_orders, purchase_order_line_items, financial_periods      ║
-- ║  + Audit trail columns for financial_transactions                           ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  1. CHART OF ACCOUNTS                                                       ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE account_type_enum AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  account_type    account_type_enum NOT NULL,
  sub_type        TEXT,
  parent_id       UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  balance         NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  context         TEXT NOT NULL DEFAULT 'business'
                    CHECK (context IN ('business', 'personal')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_code ON chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_context ON chart_of_accounts(context);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  2. JOURNAL ENTRIES                                                         ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE journal_entry_status_enum AS ENUM ('draft', 'posted', 'void');

CREATE TABLE IF NOT EXISTS journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number  TEXT NOT NULL UNIQUE,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  description   TEXT NOT NULL,
  reference     TEXT,
  status        journal_entry_status_enum NOT NULL DEFAULT 'draft',
  posted_by     TEXT,
  context       TEXT NOT NULL DEFAULT 'business'
                  CHECK (context IN ('business', 'personal')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_context ON journal_entries(context);

-- ─── Journal Entry Lines ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id  UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  debit             NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit            NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description       TEXT,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: each line must have either debit OR credit (not both)
  CONSTRAINT chk_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);

-- ─── Constraint: Debits must equal Credits per journal entry ──────────────────

CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits  NUMERIC(15,2);
  total_credits NUMERIC(15,2);
  entry_status  journal_entry_status_enum;
BEGIN
  -- Only validate when the entry is being posted
  SELECT status INTO entry_status FROM journal_entries WHERE id = NEW.journal_entry_id;
  
  IF entry_status = 'posted' THEN
    SELECT
      COALESCE(SUM(debit), 0),
      COALESCE(SUM(credit), 0)
    INTO total_debits, total_credits
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;
    
    IF total_debits != total_credits THEN
      RAISE EXCEPTION 'Journal entry % does not balance: debits (%) != credits (%)',
        NEW.journal_entry_id, total_debits, total_credits;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_journal_entry_balance
  AFTER INSERT OR UPDATE ON journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_entry_balance();

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  3. FIXED ASSETS                                                            ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE asset_category_enum AS ENUM (
  'land', 'buildings', 'vehicles', 'equipment',
  'furniture', 'computers', 'intangible', 'other'
);

CREATE TYPE depreciation_method_enum AS ENUM (
  'straight_line', 'reducing_balance', 'none'
);

CREATE TYPE asset_status_enum AS ENUM (
  'active', 'disposed', 'fully_depreciated', 'written_off'
);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  asset_code                TEXT NOT NULL UNIQUE,
  category                  asset_category_enum NOT NULL,
  purchase_date             DATE NOT NULL,
  purchase_price            NUMERIC(15,2) NOT NULL,
  current_value             NUMERIC(15,2),
  salvage_value             NUMERIC(15,2) NOT NULL DEFAULT 0,
  useful_life_months        INT NOT NULL CHECK (useful_life_months > 0),
  depreciation_method       depreciation_method_enum NOT NULL DEFAULT 'straight_line',
  accumulated_depreciation  NUMERIC(15,2) NOT NULL DEFAULT 0,
  last_depreciation_date    DATE,
  disposal_date             DATE,
  disposal_amount           NUMERIC(15,2),
  status                    asset_status_enum NOT NULL DEFAULT 'active',
  account_id                UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  supplier_id               UUID REFERENCES contacts(id) ON DELETE SET NULL,
  notes                     TEXT,
  context                   TEXT NOT NULL DEFAULT 'business'
                              CHECK (context IN ('business', 'personal')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON fixed_assets(category);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_context ON fixed_assets(context);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_account ON fixed_assets(account_id);

-- ─── Asset Depreciation Log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_depreciation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period_date     DATE NOT NULL,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  method          depreciation_method_enum NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_depreciation_log_asset ON asset_depreciation_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_depreciation_log_date ON asset_depreciation_log(period_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  4. ACCOUNTS PAYABLE / SUPPLIER BILLS                                       ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE supplier_bill_status_enum AS ENUM (
  'draft', 'received', 'approved', 'partially_paid', 'paid', 'overdue', 'void'
);

CREATE TABLE IF NOT EXISTS supplier_bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number     TEXT NOT NULL UNIQUE,
  supplier_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  status          supplier_bill_status_enum NOT NULL DEFAULT 'draft',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL,
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid     NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  reference       TEXT,
  notes           TEXT,
  context         TEXT NOT NULL DEFAULT 'business'
                    CHECK (context IN ('business', 'personal')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: amount_paid cannot exceed total
  CONSTRAINT chk_supplier_bill_paid CHECK (amount_paid <= total)
);

CREATE INDEX IF NOT EXISTS idx_supplier_bills_status ON supplier_bills(status);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_supplier ON supplier_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_due_date ON supplier_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_context ON supplier_bills(context);

-- ─── Supplier Bill Line Items ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_bill_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id         UUID NOT NULL REFERENCES supplier_bills(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(15,2) NOT NULL,
  tax_rate_id     UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  line_total      NUMERIC(15,2) NOT NULL,
  account_id      UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_bill_line_items_bill ON supplier_bill_line_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_supplier_bill_line_items_account ON supplier_bill_line_items(account_id);

-- ─── Supplier Bill Payments ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS supplier_bill_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id           UUID NOT NULL REFERENCES supplier_bills(id) ON DELETE CASCADE,
  amount            NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT,
  reference         TEXT,
  bank_account_id   UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  transaction_id    UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_bill_payments_bill ON supplier_bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_supplier_bill_payments_date ON supplier_bill_payments(payment_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  5. PURCHASE ORDERS                                                         ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE purchase_order_status_enum AS ENUM (
  'draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number       TEXT NOT NULL UNIQUE,
  supplier_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status          purchase_order_status_enum NOT NULL DEFAULT 'draft',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date   DATE,
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  notes           TEXT,
  context         TEXT NOT NULL DEFAULT 'business'
                    CHECK (context IN ('business', 'personal')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_context ON purchase_orders(context);

-- ─── Purchase Order Line Items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_order_line_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id               UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          UUID, -- FK to products table (nullable - products may not exist yet)
  description         TEXT NOT NULL,
  quantity            NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price          NUMERIC(15,2) NOT NULL,
  received_quantity   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: received cannot exceed ordered
  CONSTRAINT chk_po_received_quantity CHECK (received_quantity <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_line_items_po ON purchase_order_line_items(po_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  6. FINANCIAL PERIODS                                                       ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE financial_period_status_enum AS ENUM ('open', 'closed', 'locked');

CREATE TABLE IF NOT EXISTS financial_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      financial_period_status_enum NOT NULL DEFAULT 'open',
  context     TEXT NOT NULL DEFAULT 'business'
                CHECK (context IN ('business', 'personal')),
  closed_by   TEXT,
  closed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: end_date must be after start_date
  CONSTRAINT chk_financial_period_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_financial_periods_status ON financial_periods(status);
CREATE INDEX IF NOT EXISTS idx_financial_periods_dates ON financial_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_financial_periods_context ON financial_periods(context);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  7. AUDIT TRAIL FOR FINANCIAL TRANSACTIONS                                  ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add audit trail columns to existing financial_transactions table
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS locked       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by    TEXT;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_locked ON financial_transactions(locked);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  SEED DATA                                                                  ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Standard South African Chart of Accounts ──────────────────────────────────

-- ASSETS (1000-1999)
INSERT INTO chart_of_accounts (code, name, account_type, sub_type, is_system, context) VALUES
  -- Current Assets
  ('1000', 'Cash and Cash Equivalents', 'asset', 'current', true, 'business'),
  ('1100', 'Bank Accounts', 'asset', 'current', true, 'business'),
  ('1200', 'Accounts Receivable', 'asset', 'current', true, 'business'),
  ('1210', 'Trade Debtors', 'asset', 'current', true, 'business'),
  ('1220', 'Allowance for Doubtful Debts', 'asset', 'current', true, 'business'),
  ('1300', 'Inventory', 'asset', 'current', true, 'business'),
  ('1310', 'Raw Materials', 'asset', 'current', true, 'business'),
  ('1320', 'Work in Progress', 'asset', 'current', true, 'business'),
  ('1330', 'Finished Goods', 'asset', 'current', true, 'business'),
  ('1400', 'Prepayments', 'asset', 'current', true, 'business'),
  ('1500', 'VAT Input', 'asset', 'current', true, 'business'),
  
  -- Fixed Assets
  ('1600', 'Property, Plant & Equipment', 'asset', 'fixed', true, 'business'),
  ('1610', 'Land', 'asset', 'fixed', true, 'business'),
  ('1620', 'Buildings', 'asset', 'fixed', true, 'business'),
  ('1630', 'Vehicles', 'asset', 'fixed', true, 'business'),
  ('1640', 'Equipment', 'asset', 'fixed', true, 'business'),
  ('1650', 'Furniture and Fittings', 'asset', 'fixed', true, 'business'),
  ('1660', 'Computer Equipment', 'asset', 'fixed', true, 'business'),
  ('1670', 'Accumulated Depreciation', 'asset', 'fixed', true, 'business'),
  
  -- Intangible Assets
  ('1700', 'Intangible Assets', 'asset', 'intangible', true, 'business'),
  ('1710', 'Goodwill', 'asset', 'intangible', true, 'business'),
  ('1720', 'Patents and Trademarks', 'asset', 'intangible', true, 'business'),
  ('1730', 'Software Licenses', 'asset', 'intangible', true, 'business'),
  
  -- Investments
  ('1800', 'Long-term Investments', 'asset', 'investment', true, 'business')
ON CONFLICT (code) DO NOTHING;

-- LIABILITIES (2000-2999)
INSERT INTO chart_of_accounts (code, name, account_type, sub_type, is_system, context) VALUES
  -- Current Liabilities
  ('2000', 'Accounts Payable', 'liability', 'current', true, 'business'),
  ('2100', 'Trade Creditors', 'liability', 'current', true, 'business'),
  ('2200', 'VAT Output', 'liability', 'current', true, 'business'),
  ('2300', 'PAYE Payable', 'liability', 'current', true, 'business'),
  ('2310', 'UIF Payable', 'liability', 'current', true, 'business'),
  ('2320', 'SDL Payable', 'liability', 'current', true, 'business'),
  ('2400', 'Accrued Expenses', 'liability', 'current', true, 'business'),
  ('2500', 'Short-term Loans', 'liability', 'current', true, 'business'),
  ('2600', 'Credit Card', 'liability', 'current', true, 'business'),
  
  -- Long-term Liabilities
  ('2700', 'Long-term Loans', 'liability', 'long_term', true, 'business'),
  ('2710', 'Mortgage', 'liability', 'long_term', true, 'business'),
  ('2800', 'Deferred Tax', 'liability', 'long_term', true, 'business')
ON CONFLICT (code) DO NOTHING;

-- EQUITY (3000-3999)
INSERT INTO chart_of_accounts (code, name, account_type, sub_type, is_system, context) VALUES
  ('3000', 'Owner''s Equity', 'equity', 'capital', true, 'business'),
  ('3100', 'Share Capital', 'equity', 'capital', true, 'business'),
  ('3200', 'Retained Earnings', 'equity', 'retained', true, 'business'),
  ('3300', 'Current Year Earnings', 'equity', 'retained', true, 'business'),
  ('3400', 'Drawings', 'equity', 'drawings', true, 'business')
ON CONFLICT (code) DO NOTHING;

-- REVENUE (4000-4999)
INSERT INTO chart_of_accounts (code, name, account_type, sub_type, is_system, context) VALUES
  ('4000', 'Sales Revenue', 'revenue', 'operating', true, 'business'),
  ('4100', 'Service Revenue', 'revenue', 'operating', true, 'business'),
  ('4200', 'Interest Income', 'revenue', 'other', true, 'business'),
  ('4300', 'Rental Income', 'revenue', 'other', true, 'business'),
  ('4400', 'Foreign Exchange Gain', 'revenue', 'other', true, 'business'),
  ('4500', 'Other Income', 'revenue', 'other', true, 'business')
ON CONFLICT (code) DO NOTHING;

-- EXPENSES (5000-9999)
INSERT INTO chart_of_accounts (code, name, account_type, sub_type, is_system, context) VALUES
  -- Cost of Sales
  ('5000', 'Cost of Goods Sold', 'expense', 'cogs', true, 'business'),
  ('5100', 'Direct Materials', 'expense', 'cogs', true, 'business'),
  ('5200', 'Direct Labour', 'expense', 'cogs', true, 'business'),
  ('5300', 'Manufacturing Overhead', 'expense', 'cogs', true, 'business'),
  
  -- Operating Expenses
  ('6000', 'Operating Expenses', 'expense', 'operating', true, 'business'),
  ('6100', 'Salaries and Wages', 'expense', 'operating', true, 'business'),
  ('6110', 'PAYE', 'expense', 'operating', true, 'business'),
  ('6120', 'UIF', 'expense', 'operating', true, 'business'),
  ('6130', 'SDL', 'expense', 'operating', true, 'business'),
  ('6200', 'Rent', 'expense', 'operating', true, 'business'),
  ('6300', 'Utilities', 'expense', 'operating', true, 'business'),
  ('6310', 'Electricity', 'expense', 'operating', true, 'business'),
  ('6320', 'Water', 'expense', 'operating', true, 'business'),
  ('6330', 'Telephone and Internet', 'expense', 'operating', true, 'business'),
  ('6400', 'Insurance', 'expense', 'operating', true, 'business'),
  ('6500', 'Marketing and Advertising', 'expense', 'operating', true, 'business'),
  ('6600', 'Office Supplies', 'expense', 'operating', true, 'business'),
  ('6700', 'Travel and Accommodation', 'expense', 'operating', true, 'business'),
  ('6800', 'Professional Fees', 'expense', 'operating', true, 'business'),
  ('6810', 'Accounting Fees', 'expense', 'operating', true, 'business'),
  ('6820', 'Legal Fees', 'expense', 'operating', true, 'business'),
  ('6900', 'Software and Subscriptions', 'expense', 'operating', true, 'business'),
  
  -- Depreciation and Amortization
  ('7000', 'Depreciation', 'expense', 'depreciation', true, 'business'),
  ('7100', 'Amortization', 'expense', 'depreciation', true, 'business'),
  
  -- Financial Costs
  ('8000', 'Interest Expense', 'expense', 'financial', true, 'business'),
  ('8100', 'Bank Charges', 'expense', 'financial', true, 'business'),
  ('8200', 'Foreign Exchange Loss', 'expense', 'financial', true, 'business'),
  
  -- Other Expenses
  ('9000', 'Bad Debts', 'expense', 'other', true, 'business'),
  ('9100', 'Repairs and Maintenance', 'expense', 'other', true, 'business'),
  ('9200', 'Donations', 'expense', 'other', true, 'business'),
  ('9900', 'Miscellaneous Expenses', 'expense', 'other', true, 'business')
ON CONFLICT (code) DO NOTHING;

-- ─── South African Financial Periods (March - February Tax Year) ──────────────

INSERT INTO financial_periods (name, start_date, end_date, status, context) VALUES
  -- Current tax year (2024/2025)
  ('FY 2024/2025', '2024-03-01', '2025-02-28', 'open', 'business'),
  
  -- Next tax year (2025/2026)
  ('FY 2025/2026', '2025-03-01', '2026-02-28', 'open', 'business'),
  
  -- Previous tax year (2023/2024)
  ('FY 2023/2024', '2023-03-01', '2024-02-29', 'closed', 'business')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  ROW LEVEL SECURITY                                                         ║
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE chart_of_accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_depreciation_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_bills                ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_bill_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_bill_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_periods             ENABLE ROW LEVEL SECURITY;

-- Open policies (as requested)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'chart_of_accounts',
    'journal_entries',
    'journal_entry_lines',
    'fixed_assets',
    'asset_depreciation_log',
    'supplier_bills',
    'supplier_bill_line_items',
    'supplier_bill_payments',
    'purchase_orders',
    'purchase_order_line_items',
    'financial_periods'
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  REALTIME                                                                   ║
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE chart_of_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE journal_entry_lines;
ALTER PUBLICATION supabase_realtime ADD TABLE fixed_assets;
ALTER PUBLICATION supabase_realtime ADD TABLE asset_depreciation_log;
ALTER PUBLICATION supabase_realtime ADD TABLE supplier_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE supplier_bill_line_items;
ALTER PUBLICATION supabase_realtime ADD TABLE supplier_bill_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_order_line_items;
ALTER PUBLICATION supabase_realtime ADD TABLE financial_periods;
