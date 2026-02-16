-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Financial Views, Payroll, Multi-Currency & VAT                             ║
-- ║  Tables: employees, payroll_runs, payslips, currency_rates, petty_cash      ║
-- ║  Views: v_balance_sheet, v_trial_balance, v_payables_aging, v_vat_return,   ║
-- ║         v_depreciation_schedule, v_payroll_summary, v_financial_health,     ║
-- ║         v_financial_dashboard                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  1. EMPLOYEES                                                               ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE employee_status_enum AS ENUM ('active', 'suspended', 'terminated', 'on_leave');

CREATE TABLE IF NOT EXISTS employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  employee_number   TEXT NOT NULL UNIQUE,
  department        TEXT,
  position          TEXT,
  salary            NUMERIC(15,2) NOT NULL,
  tax_number        TEXT,
  bank_details      JSONB,
  status            employee_status_enum NOT NULL DEFAULT 'active',
  hired_at          DATE NOT NULL,
  terminated_at     DATE,
  context           TEXT NOT NULL DEFAULT 'business'
                      CHECK (context IN ('business', 'personal')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: terminated_at must be after hired_at
  CONSTRAINT chk_employee_dates CHECK (terminated_at IS NULL OR terminated_at >= hired_at)
);

CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_context ON employees(context);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  2. PAYROLL RUNS                                                            ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE payroll_status_enum AS ENUM ('draft', 'processing', 'processed', 'paid', 'cancelled');

CREATE TABLE IF NOT EXISTS payroll_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  status              payroll_status_enum NOT NULL DEFAULT 'draft',
  total_gross         NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions    NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net           NUMERIC(15,2) NOT NULL DEFAULT 0,
  processed_at        TIMESTAMPTZ,
  processed_by        TEXT,
  context             TEXT NOT NULL DEFAULT 'business'
                        CHECK (context IN ('business', 'personal')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: period_end must be after period_start
  CONSTRAINT chk_payroll_period CHECK (period_end > period_start),
  -- Constraint: net = gross - deductions
  CONSTRAINT chk_payroll_amounts CHECK (total_net = total_gross - total_deductions)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON payroll_runs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_context ON payroll_runs(context);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  3. PAYSLIPS                                                                ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payslips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id    UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross_amount      NUMERIC(15,2) NOT NULL,
  deductions        JSONB NOT NULL DEFAULT '{}'::jsonb,
  net_amount        NUMERIC(15,2) NOT NULL,
  tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: gross_amount must be positive
  CONSTRAINT chk_payslip_gross CHECK (gross_amount > 0),
  -- Unique: one payslip per employee per payroll run
  CONSTRAINT uk_payslip_employee_run UNIQUE (payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payslips_payroll_run ON payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  4. CURRENCY RATES                                                          ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS currency_rates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency     TEXT NOT NULL DEFAULT 'ZAR',
  target_currency   TEXT NOT NULL,
  rate              NUMERIC(15,6) NOT NULL,
  effective_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  source            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: rate must be positive
  CONSTRAINT chk_currency_rate CHECK (rate > 0),
  -- Unique: one rate per currency pair per date
  CONSTRAINT uk_currency_rate UNIQUE (base_currency, target_currency, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_currency_rates_pair ON currency_rates(base_currency, target_currency);
CREATE INDEX IF NOT EXISTS idx_currency_rates_date ON currency_rates(effective_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  5. PETTY CASH                                                              ║
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS petty_cash (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  description       TEXT NOT NULL,
  amount            NUMERIC(15,2) NOT NULL,
  category          TEXT,
  receipt_ref       TEXT,
  recorded_by       TEXT,
  bank_account_id   UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  context           TEXT NOT NULL DEFAULT 'business'
                      CHECK (context IN ('business', 'personal')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: amount cannot be zero
  CONSTRAINT chk_petty_cash_amount CHECK (amount != 0)
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON petty_cash(date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_category ON petty_cash(category);
CREATE INDEX IF NOT EXISTS idx_petty_cash_context ON petty_cash(context);
CREATE INDEX IF NOT EXISTS idx_petty_cash_bank_account ON petty_cash(bank_account_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  VIEWS                                                                      ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. v_balance_sheet ────────────────────────────────────────────────────────
-- Balance sheet view showing assets, liabilities, and equity from chart of accounts

CREATE OR REPLACE VIEW v_balance_sheet AS
WITH account_balances AS (
  SELECT
    coa.id,
    coa.code,
    coa.name,
    coa.account_type,
    coa.sub_type,
    coa.context,
    coa.currency,
    -- Calculate balance from journal entries
    COALESCE(coa.balance, 0) +
    COALESCE(
      (SELECT SUM(jel.debit - jel.credit)
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE jel.account_id = coa.id
         AND je.status = 'posted'),
      0
    ) AS current_balance
  FROM chart_of_accounts coa
  WHERE coa.account_type IN ('asset', 'liability', 'equity')
)
SELECT
  context,
  currency,
  account_type,
  sub_type,
  code,
  name,
  current_balance
FROM account_balances
WHERE ABS(current_balance) > 0.01  -- Exclude near-zero balances
ORDER BY context, currency, account_type, code;

-- ─── 2. v_trial_balance ────────────────────────────────────────────────────────
-- Trial balance view showing debit and credit totals per account

CREATE OR REPLACE VIEW v_trial_balance AS
WITH account_totals AS (
  SELECT
    coa.id,
    coa.code,
    coa.name,
    coa.account_type,
    coa.context,
    coa.currency,
    coa.balance AS opening_balance,
    COALESCE(SUM(jel.debit), 0) AS total_debits,
    COALESCE(SUM(jel.credit), 0) AS total_credits
  FROM chart_of_accounts coa
  LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.context, coa.currency, coa.balance
)
SELECT
  context,
  currency,
  code,
  name,
  account_type,
  opening_balance,
  total_debits,
  total_credits,
  opening_balance + total_debits - total_credits AS closing_balance
FROM account_totals
ORDER BY context, currency, code;

-- ─── 3. v_payables_aging ───────────────────────────────────────────────────────
-- Accounts payable aging report with aging buckets

CREATE OR REPLACE VIEW v_payables_aging AS
WITH bill_aging AS (
  SELECT
    sb.id,
    sb.bill_number,
    sb.supplier_id,
    COALESCE(c.first_name || ' ' || c.last_name, 'Unknown') AS supplier_name,
    sb.issue_date,
    sb.due_date,
    sb.total,
    sb.amount_paid,
    sb.total - sb.amount_paid AS outstanding,
    sb.currency,
    sb.context,
    (CURRENT_DATE - sb.due_date) AS days_overdue
  FROM supplier_bills sb
  LEFT JOIN contacts c ON c.id = sb.supplier_id
  WHERE sb.status IN ('received', 'approved', 'partially_paid', 'overdue')
    AND sb.total > sb.amount_paid
)
SELECT
  context,
  currency,
  supplier_id,
  supplier_name,
  COUNT(*) AS bill_count,
  SUM(outstanding) AS total_outstanding,
  SUM(CASE WHEN days_overdue <= 0 THEN outstanding ELSE 0 END) AS current_amount,
  SUM(CASE WHEN days_overdue BETWEEN 1 AND 30 THEN outstanding ELSE 0 END) AS days_1_30,
  SUM(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN outstanding ELSE 0 END) AS days_31_60,
  SUM(CASE WHEN days_overdue BETWEEN 61 AND 90 THEN outstanding ELSE 0 END) AS days_61_90,
  SUM(CASE WHEN days_overdue > 90 THEN outstanding ELSE 0 END) AS days_over_90,
  MIN(due_date) AS oldest_due_date,
  MAX(days_overdue) AS max_days_overdue
FROM bill_aging
GROUP BY context, currency, supplier_id, supplier_name
ORDER BY total_outstanding DESC;

-- ─── 4. v_vat_return ───────────────────────────────────────────────────────────
-- VAT return view showing output VAT (from invoices) and input VAT (from supplier bills)

CREATE OR REPLACE VIEW v_vat_return AS
WITH output_vat AS (
  SELECT
    DATE_TRUNC('month', i.issue_date)::date AS period,
    i.currency,
    SUM(i.total - i.subtotal) AS vat_collected
  FROM invoices i
  WHERE i.status IN ('sent', 'partially_paid', 'paid', 'overdue')
    AND i.total > i.subtotal  -- Has VAT
  GROUP BY DATE_TRUNC('month', i.issue_date)::date, i.currency
),
input_vat AS (
  SELECT
    DATE_TRUNC('month', sb.issue_date)::date AS period,
    sb.currency,
    SUM(sb.tax_total) AS vat_paid
  FROM supplier_bills sb
  WHERE sb.status IN ('received', 'approved', 'partially_paid', 'paid')
    AND sb.tax_total > 0
  GROUP BY DATE_TRUNC('month', sb.issue_date)::date, sb.currency
)
SELECT
  COALESCE(ov.period, iv.period) AS period,
  COALESCE(ov.currency, iv.currency) AS currency,
  COALESCE(ov.vat_collected, 0) AS output_vat,
  COALESCE(iv.vat_paid, 0) AS input_vat,
  COALESCE(ov.vat_collected, 0) - COALESCE(iv.vat_paid, 0) AS net_vat_payable
FROM output_vat ov
FULL OUTER JOIN input_vat iv ON iv.period = ov.period AND iv.currency = ov.currency
ORDER BY period DESC, currency;

-- ─── 5. v_depreciation_schedule ────────────────────────────────────────────────
-- Fixed asset depreciation schedule

CREATE OR REPLACE VIEW v_depreciation_schedule AS
SELECT
  fa.id,
  fa.asset_code,
  fa.name,
  fa.category,
  fa.purchase_date,
  fa.purchase_price,
  fa.salvage_value,
  fa.useful_life_months,
  fa.depreciation_method,
  fa.accumulated_depreciation,
  fa.purchase_price - fa.accumulated_depreciation AS net_book_value,
  fa.last_depreciation_date,
  fa.status,
  fa.context,
  -- Calculate monthly depreciation
  CASE
    WHEN fa.depreciation_method = 'straight_line' AND fa.useful_life_months > 0
      THEN (fa.purchase_price - fa.salvage_value) / fa.useful_life_months
    WHEN fa.depreciation_method = 'reducing_balance'
      THEN (fa.purchase_price - fa.accumulated_depreciation) * 0.20 / 12  -- 20% reducing balance
    ELSE 0
  END AS monthly_depreciation,
  -- Calculate remaining months
  CASE
    WHEN fa.depreciation_method = 'straight_line' AND fa.useful_life_months > 0
      THEN fa.useful_life_months - 
           EXTRACT(MONTH FROM AGE(COALESCE(fa.last_depreciation_date, CURRENT_DATE), fa.purchase_date))::int
    ELSE NULL
  END AS months_remaining,
  -- Total depreciation from log
  (SELECT COALESCE(SUM(adl.amount), 0)
   FROM asset_depreciation_log adl
   WHERE adl.asset_id = fa.id) AS total_depreciation_logged
FROM fixed_assets fa
WHERE fa.status = 'active'
ORDER BY fa.context, fa.category, fa.asset_code;

-- ─── 6. v_payroll_summary ──────────────────────────────────────────────────────
-- Payroll summary by period

CREATE OR REPLACE VIEW v_payroll_summary AS
SELECT
  pr.id AS payroll_run_id,
  pr.period_start,
  pr.period_end,
  pr.status,
  pr.context,
  COUNT(ps.id) AS employee_count,
  pr.total_gross,
  pr.total_deductions,
  pr.total_net,
  -- PAYE calculation (simplified - actual PAYE is complex)
  SUM(ps.tax_amount) AS total_paye,
  -- UIF calculation (1% of gross, max R177.12 per month in 2024)
  SUM(LEAST(ps.gross_amount * 0.01, 177.12)) AS total_uif,
  -- SDL calculation (1% of gross for companies)
  CASE WHEN pr.context = 'business' THEN pr.total_gross * 0.01 ELSE 0 END AS total_sdl,
  pr.processed_at,
  pr.processed_by
FROM payroll_runs pr
LEFT JOIN payslips ps ON ps.payroll_run_id = pr.id
GROUP BY pr.id, pr.period_start, pr.period_end, pr.status, pr.context,
         pr.total_gross, pr.total_deductions, pr.total_net, pr.processed_at, pr.processed_by
ORDER BY pr.period_start DESC;

-- ─── 7. v_financial_health ─────────────────────────────────────────────────────
-- Financial health ratios and metrics

CREATE OR REPLACE VIEW v_financial_health AS
WITH balance_sheet_totals AS (
  SELECT
    context,
    currency,
    SUM(CASE WHEN account_type = 'asset' AND sub_type = 'current' THEN current_balance ELSE 0 END) AS current_assets,
    SUM(CASE WHEN account_type = 'asset' THEN current_balance ELSE 0 END) AS total_assets,
    SUM(CASE WHEN account_type = 'liability' AND sub_type = 'current' THEN current_balance ELSE 0 END) AS current_liabilities,
    SUM(CASE WHEN account_type = 'liability' THEN current_balance ELSE 0 END) AS total_liabilities,
    SUM(CASE WHEN account_type = 'equity' THEN current_balance ELSE 0 END) AS total_equity
  FROM v_balance_sheet
  GROUP BY context, currency
),
quick_assets AS (
  SELECT
    context,
    currency,
    SUM(current_balance) AS quick_asset_total
  FROM v_balance_sheet
  WHERE account_type = 'asset'
    AND sub_type = 'current'
    AND code NOT IN ('1300', '1310', '1320', '1330')  -- Exclude inventory accounts
  GROUP BY context, currency
)
SELECT
  bst.context,
  bst.currency,
  bst.current_assets,
  bst.total_assets,
  bst.current_liabilities,
  bst.total_liabilities,
  bst.total_equity,
  -- Current Ratio = Current Assets / Current Liabilities
  CASE
    WHEN bst.current_liabilities > 0
      THEN ROUND(bst.current_assets / bst.current_liabilities, 2)
    ELSE NULL
  END AS current_ratio,
  -- Quick Ratio = (Current Assets - Inventory) / Current Liabilities
  CASE
    WHEN bst.current_liabilities > 0
      THEN ROUND(qa.quick_asset_total / bst.current_liabilities, 2)
    ELSE NULL
  END AS quick_ratio,
  -- Debt-to-Equity Ratio = Total Liabilities / Total Equity
  CASE
    WHEN bst.total_equity > 0
      THEN ROUND(bst.total_liabilities / bst.total_equity, 2)
    ELSE NULL
  END AS debt_to_equity_ratio,
  -- Working Capital = Current Assets - Current Liabilities
  bst.current_assets - bst.current_liabilities AS working_capital,
  -- Equity Ratio = Total Equity / Total Assets
  CASE
    WHEN bst.total_assets > 0
      THEN ROUND(bst.total_equity / bst.total_assets, 2)
    ELSE NULL
  END AS equity_ratio
FROM balance_sheet_totals bst
LEFT JOIN quick_assets qa ON qa.context = bst.context AND qa.currency = bst.currency;

-- ─── 8. v_financial_dashboard ──────────────────────────────────────────────────
-- Financial dashboard with key KPIs

CREATE OR REPLACE VIEW v_financial_dashboard AS
WITH monthly_revenue AS (
  SELECT
    DATE_TRUNC('month', transaction_date)::date AS month,
    currency,
    SUM(amount) AS total_revenue
  FROM financial_transactions
  WHERE transaction_type = 'income'
    AND status IN ('completed', 'reconciled')
    AND transaction_date >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY DATE_TRUNC('month', transaction_date)::date, currency
),
monthly_expenses AS (
  SELECT
    DATE_TRUNC('month', transaction_date)::date AS month,
    currency,
    SUM(amount) AS total_expenses
  FROM financial_transactions
  WHERE transaction_type = 'expense'
    AND status IN ('completed', 'reconciled')
    AND transaction_date >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY DATE_TRUNC('month', transaction_date)::date, currency
),
current_month_stats AS (
  SELECT
    DATE_TRUNC('month', CURRENT_DATE)::date AS current_month
),
bank_balances AS (
  SELECT
    currency,
    SUM(current_balance) AS total_cash
  FROM bank_accounts
  WHERE is_active = true
  GROUP BY currency
),
receivables AS (
  SELECT
    currency,
    SUM(total - amount_paid) AS total_receivables
  FROM invoices
  WHERE status IN ('sent', 'partially_paid', 'overdue')
  GROUP BY currency
),
payables AS (
  SELECT
    currency,
    SUM(total - amount_paid) AS total_payables
  FROM supplier_bills
  WHERE status IN ('received', 'approved', 'partially_paid', 'overdue')
  GROUP BY currency
)
SELECT
  cms.current_month,
  COALESCE(bb.currency, 'ZAR') AS currency,
  -- Cash position
  COALESCE(bb.total_cash, 0) AS cash_on_hand,
  -- Current month revenue
  COALESCE(mr_current.total_revenue, 0) AS current_month_revenue,
  -- Current month expenses
  COALESCE(me_current.total_expenses, 0) AS current_month_expenses,
  -- Current month profit
  COALESCE(mr_current.total_revenue, 0) - COALESCE(me_current.total_expenses, 0) AS current_month_profit,
  -- Previous month revenue
  COALESCE(mr_previous.total_revenue, 0) AS previous_month_revenue,
  -- Previous month expenses
  COALESCE(me_previous.total_expenses, 0) AS previous_month_expenses,
  -- YTD revenue
  COALESCE(
    (SELECT SUM(total_revenue)
     FROM monthly_revenue
     WHERE month >= DATE_TRUNC('year', CURRENT_DATE)::date
       AND currency = COALESCE(bb.currency, 'ZAR')),
    0
  ) AS ytd_revenue,
  -- YTD expenses
  COALESCE(
    (SELECT SUM(total_expenses)
     FROM monthly_expenses
     WHERE month >= DATE_TRUNC('year', CURRENT_DATE)::date
       AND currency = COALESCE(bb.currency, 'ZAR')),
    0
  ) AS ytd_expenses,
  -- Receivables
  COALESCE(r.total_receivables, 0) AS outstanding_receivables,
  -- Payables
  COALESCE(p.total_payables, 0) AS outstanding_payables,
  -- Net position (cash + receivables - payables)
  COALESCE(bb.total_cash, 0) + COALESCE(r.total_receivables, 0) - COALESCE(p.total_payables, 0) AS net_position
FROM current_month_stats cms
CROSS JOIN bank_balances bb
LEFT JOIN monthly_revenue mr_current ON mr_current.month = cms.current_month AND mr_current.currency = bb.currency
LEFT JOIN monthly_expenses me_current ON me_current.month = cms.current_month AND me_current.currency = bb.currency
LEFT JOIN monthly_revenue mr_previous ON mr_previous.month = cms.current_month - INTERVAL '1 month' AND mr_previous.currency = bb.currency
LEFT JOIN monthly_expenses me_previous ON me_previous.month = cms.current_month - INTERVAL '1 month' AND me_previous.currency = bb.currency
LEFT JOIN receivables r ON r.currency = bb.currency
LEFT JOIN payables p ON p.currency = bb.currency;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  ROW LEVEL SECURITY                                                         ║
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE employees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips          ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash        ENABLE ROW LEVEL SECURITY;

-- Open policies (as requested)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'employees',
    'payroll_runs',
    'payslips',
    'currency_rates',
    'petty_cash'
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

ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE payroll_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE payslips;
ALTER PUBLICATION supabase_realtime ADD TABLE currency_rates;
ALTER PUBLICATION supabase_realtime ADD TABLE petty_cash;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  SEED DATA                                                                  ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- Seed common currency rates (as of 2024)
INSERT INTO currency_rates (base_currency, target_currency, rate, effective_date, source) VALUES
  ('ZAR', 'USD', 0.054, CURRENT_DATE, 'Manual entry'),
  ('ZAR', 'EUR', 0.050, CURRENT_DATE, 'Manual entry'),
  ('ZAR', 'GBP', 0.043, CURRENT_DATE, 'Manual entry'),
  ('USD', 'ZAR', 18.50, CURRENT_DATE, 'Manual entry'),
  ('EUR', 'ZAR', 20.00, CURRENT_DATE, 'Manual entry'),
  ('GBP', 'ZAR', 23.30, CURRENT_DATE, 'Manual entry')
ON CONFLICT (base_currency, target_currency, effective_date) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  COMMENTS                                                                   ║
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE employees IS 'Employee master data for payroll';
COMMENT ON TABLE payroll_runs IS 'Payroll processing runs by period';
COMMENT ON TABLE payslips IS 'Individual employee payslips';
COMMENT ON TABLE currency_rates IS 'Exchange rates for multi-currency support';
COMMENT ON TABLE petty_cash IS 'Petty cash transactions';

COMMENT ON VIEW v_balance_sheet IS 'Balance sheet: assets, liabilities, equity';
COMMENT ON VIEW v_trial_balance IS 'Trial balance: debit/credit totals per account';
COMMENT ON VIEW v_payables_aging IS 'Accounts payable aging analysis';
COMMENT ON VIEW v_vat_return IS 'VAT return: output VAT vs input VAT';
COMMENT ON VIEW v_depreciation_schedule IS 'Fixed asset depreciation schedule';
COMMENT ON VIEW v_payroll_summary IS 'Payroll summary by period';
COMMENT ON VIEW v_financial_health IS 'Financial health ratios and metrics';
COMMENT ON VIEW v_financial_dashboard IS 'Financial dashboard KPIs';
