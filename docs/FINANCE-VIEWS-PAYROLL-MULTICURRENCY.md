# Financial Views, Payroll, Multi-Currency & VAT

## Overview

Comprehensive financial reporting infrastructure with views for balance sheet, trial balance, VAT returns, payroll management, multi-currency support, and financial health metrics.

---

## Tables Created

### 1. Employees

**Table:** `employees`

Employee master data for payroll processing.

**Fields:**
- `id` — UUID primary key
- `name` — TEXT NOT NULL
- `employee_number` — TEXT UNIQUE
- `department` — TEXT
- `position` — TEXT
- `salary` — NUMERIC(15,2) NOT NULL
- `tax_number` — TEXT (ID/passport number for PAYE)
- `bank_details` — JSONB (account number, bank, branch)
- `status` — ENUM ('active', 'suspended', 'terminated', 'on_leave')
- `hired_at` — DATE NOT NULL
- `terminated_at` — DATE
- `context` — ENUM ('business', 'personal')
- `notes` — TEXT
- `created_at`, `updated_at` — Timestamps

**Constraints:**
- `chk_employee_dates` — terminated_at ≥ hired_at
- `uk_employee_number` — Unique employee number

**Indexes:**
- `idx_employees_status` — Filter by status
- `idx_employees_department` — Group by department
- `idx_employees_context` — Business/personal separation

**Example:**
```sql
INSERT INTO employees (
  name, employee_number, department, position, salary, tax_number,
  bank_details, status, hired_at, context
) VALUES (
  'John Doe', 'EMP-001', 'Engineering', 'Senior Developer', 65000.00,
  '8001015800082',
  '{"account": "12345678", "bank": "FNB", "branch": "250655"}'::jsonb,
  'active', '2024-01-15', 'business'
);
```

---

### 2. Payroll Runs

**Table:** `payroll_runs`

Payroll processing runs by period.

**Fields:**
- `id` — UUID
- `period_start` — DATE NOT NULL
- `period_end` — DATE NOT NULL
- `status` — ENUM ('draft', 'processing', 'processed', 'paid', 'cancelled')
- `total_gross` — NUMERIC(15,2) (sum of all gross amounts)
- `total_deductions` — NUMERIC(15,2) (sum of all deductions)
- `total_net` — NUMERIC(15,2) (gross - deductions)
- `processed_at` — TIMESTAMPTZ (when finalized)
- `processed_by` — TEXT (user who processed)
- `context` — ENUM ('business', 'personal')
- `notes` — TEXT
- `created_at`, `updated_at` — Timestamps

**Constraints:**
- `chk_payroll_period` — period_end > period_start
- `chk_payroll_amounts` — total_net = total_gross - total_deductions

**Workflow:**
draft → processing → processed → paid

**Example:**
```sql
INSERT INTO payroll_runs (
  period_start, period_end, status, total_gross, total_deductions, total_net, context
) VALUES (
  '2024-02-01', '2024-02-29', 'draft', 0, 0, 0, 'business'
) RETURNING id;
```

---

### 3. Payslips

**Table:** `payslips`

Individual employee payslips for each payroll run.

**Fields:**
- `id` — UUID
- `payroll_run_id` — FK to payroll_runs
- `employee_id` — FK to employees
- `gross_amount` — NUMERIC(15,2) NOT NULL
- `deductions` — JSONB (breakdown: paye, uif, pension, etc.)
- `net_amount` — NUMERIC(15,2) NOT NULL
- `tax_amount` — NUMERIC(15,2) (PAYE amount)
- `created_at` — Timestamp

**Constraints:**
- `chk_payslip_gross` — gross_amount > 0
- `uk_payslip_employee_run` — One payslip per employee per run

**Deductions JSONB Structure:**
```json
{
  "paye": 12500.00,
  "uif": 177.12,
  "pension": 6500.00,
  "medical_aid": 3500.00,
  "other": 0
}
```

**Example:**
```sql
INSERT INTO payslips (
  payroll_run_id, employee_id, gross_amount, 
  deductions, net_amount, tax_amount
) VALUES (
  'payroll-run-uuid', 'employee-uuid', 65000.00,
  '{"paye": 12500, "uif": 177.12, "pension": 6500, "medical_aid": 3500}'::jsonb,
  42322.88, 12500.00
);
```

---

### 4. Currency Rates

**Table:** `currency_rates`

Exchange rates for multi-currency support.

**Fields:**
- `id` — UUID
- `base_currency` — TEXT (default 'ZAR')
- `target_currency` — TEXT NOT NULL
- `rate` — NUMERIC(15,6) NOT NULL (6 decimal precision for FX)
- `effective_date` — DATE (default CURRENT_DATE)
- `source` — TEXT (e.g., 'SARB', 'Manual entry', 'API')
- `created_at` — Timestamp

**Constraints:**
- `chk_currency_rate` — rate > 0
- `uk_currency_rate` — Unique (base_currency, target_currency, effective_date)

**Seed Data (6 common pairs):**
- ZAR/USD: 0.054
- ZAR/EUR: 0.050
- ZAR/GBP: 0.043
- USD/ZAR: 18.50
- EUR/ZAR: 20.00
- GBP/ZAR: 23.30

**Example:**
```sql
-- Get latest ZAR to USD rate
SELECT rate FROM currency_rates
WHERE base_currency = 'ZAR' AND target_currency = 'USD'
ORDER BY effective_date DESC
LIMIT 1;

-- Convert ZAR to USD
SELECT 10000.00 * rate AS usd_amount
FROM currency_rates
WHERE base_currency = 'ZAR' AND target_currency = 'USD'
ORDER BY effective_date DESC
LIMIT 1;
```

---

### 5. Petty Cash

**Table:** `petty_cash`

Small cash transactions not going through bank accounts.

**Fields:**
- `id` — UUID
- `date` — DATE (default CURRENT_DATE)
- `description` — TEXT NOT NULL
- `amount` — NUMERIC(15,2) NOT NULL
- `category` — TEXT (e.g., 'office supplies', 'travel')
- `receipt_ref` — TEXT (receipt number)
- `recorded_by` — TEXT (user who recorded)
- `bank_account_id` — FK to bank_accounts (optional, for petty cash replenishment)
- `context` — ENUM ('business', 'personal')
- `created_at` — Timestamp

**Constraints:**
- `chk_petty_cash_amount` — amount ≠ 0

**Example:**
```sql
-- Record petty cash expense
INSERT INTO petty_cash (
  date, description, amount, category, receipt_ref, recorded_by, context
) VALUES (
  CURRENT_DATE, 'Coffee for office meeting', -85.50, 'office supplies',
  'PC-2024-001', 'John Doe', 'business'
);

-- Petty cash replenishment from bank
INSERT INTO petty_cash (
  date, description, amount, bank_account_id, recorded_by, context
) VALUES (
  CURRENT_DATE, 'Petty cash replenishment', 1000.00,
  'bank-account-uuid', 'John Doe', 'business'
);
```

---

## Views Created

### 1. v_balance_sheet

**Purpose:** Balance sheet showing assets, liabilities, and equity.

**Columns:**
- `context` — Business/personal
- `currency` — Currency code
- `account_type` — asset, liability, equity
- `sub_type` — current, fixed, long_term, etc.
- `code` — Account code
- `name` — Account name
- `current_balance` — Calculated balance

**Calculation:**
- Base balance from `chart_of_accounts.balance`
- Plus journal entry debits - credits (posted entries only)
- Excludes near-zero balances (< 0.01)

**Example Query:**
```sql
-- Assets summary
SELECT account_type, SUM(current_balance) as total
FROM v_balance_sheet
WHERE context = 'business' AND currency = 'ZAR'
GROUP BY account_type;

-- Current assets
SELECT code, name, current_balance
FROM v_balance_sheet
WHERE account_type = 'asset' AND sub_type = 'current';
```

---

### 2. v_trial_balance

**Purpose:** Trial balance showing debit/credit totals per account.

**Columns:**
- `context` — Business/personal
- `currency` — Currency code
- `code` — Account code
- `name` — Account name
- `account_type` — Account type
- `opening_balance` — Opening balance
- `total_debits` — Sum of debit entries
- `total_credits` — Sum of credit entries
- `closing_balance` — opening + debits - credits

**Use Case:** Verify debits = credits across all accounts.

**Example Query:**
```sql
-- Trial balance totals
SELECT
  SUM(total_debits) as total_debits,
  SUM(total_credits) as total_credits,
  SUM(total_debits) - SUM(total_credits) as difference
FROM v_trial_balance
WHERE context = 'business';
-- Should be 0 if balanced
```

---

### 3. v_payables_aging

**Purpose:** Accounts payable aging analysis by supplier.

**Columns:**
- `context` — Business/personal
- `currency` — Currency code
- `supplier_id` — Supplier UUID
- `supplier_name` — Supplier full name
- `bill_count` — Number of outstanding bills
- `total_outstanding` — Total amount owed
- `current_amount` — Not yet due
- `days_1_30` — 1-30 days overdue
- `days_31_60` — 31-60 days overdue
- `days_61_90` — 61-90 days overdue
- `days_over_90` — 90+ days overdue
- `oldest_due_date` — Oldest bill due date
- `max_days_overdue` — Maximum days overdue

**Example Query:**
```sql
-- Critical suppliers (90+ days overdue)
SELECT supplier_name, days_over_90, oldest_due_date
FROM v_payables_aging
WHERE days_over_90 > 0
ORDER BY days_over_90 DESC;

-- Total payables by aging bucket
SELECT
  SUM(current_amount) as current,
  SUM(days_1_30) as d30,
  SUM(days_31_60) as d60,
  SUM(days_61_90) as d90,
  SUM(days_over_90) as d90plus
FROM v_payables_aging
WHERE currency = 'ZAR';
```

---

### 4. v_vat_return

**Purpose:** VAT return showing output VAT (collected) vs input VAT (paid).

**Columns:**
- `period` — Month (first day of month)
- `currency` — Currency code
- `output_vat` — VAT collected from invoices
- `input_vat` — VAT paid on supplier bills
- `net_vat_payable` — output_vat - input_vat (amount owed to SARS)

**Calculation:**
- **Output VAT:** From invoices (total - subtotal) where status in (sent, paid, etc.)
- **Input VAT:** From supplier_bills.tax_total where status in (received, paid, etc.)
- **Net VAT:** Output - Input (positive = owe SARS, negative = credit)

**Example Query:**
```sql
-- Current month VAT position
SELECT period, output_vat, input_vat, net_vat_payable
FROM v_vat_return
WHERE period = DATE_TRUNC('month', CURRENT_DATE)::date
  AND currency = 'ZAR';

-- VAT201 return preparation
SELECT
  period,
  output_vat as box_5,
  input_vat as box_16,
  net_vat_payable as box_19
FROM v_vat_return
WHERE period BETWEEN '2024-01-01' AND '2024-12-01'
  AND currency = 'ZAR'
ORDER BY period;
```

---

### 5. v_depreciation_schedule

**Purpose:** Fixed asset depreciation schedule with calculations.

**Columns:**
- `id` — Asset UUID
- `asset_code` — Asset code
- `name` — Asset name
- `category` — Asset category
- `purchase_date` — Purchase date
- `purchase_price` — Original cost
- `salvage_value` — Residual value
- `useful_life_months` — Total useful life
- `depreciation_method` — Method used
- `accumulated_depreciation` — Total depreciation to date
- `net_book_value` — purchase_price - accumulated_depreciation
- `last_depreciation_date` — Last depreciation run
- `status` — Asset status
- `context` — Business/personal
- `monthly_depreciation` — Calculated monthly depreciation
- `months_remaining` — Remaining useful life
- `total_depreciation_logged` — Total from depreciation log

**Depreciation Calculations:**
- **Straight-line:** (purchase_price - salvage_value) / useful_life_months
- **Reducing balance:** (purchase_price - accumulated_depreciation) × 20% / 12

**Example Query:**
```sql
-- Current month depreciation expense
SELECT
  SUM(monthly_depreciation) as total_depreciation
FROM v_depreciation_schedule
WHERE status = 'active' AND context = 'business';

-- Assets needing depreciation
SELECT asset_code, name, monthly_depreciation, last_depreciation_date
FROM v_depreciation_schedule
WHERE status = 'active'
  AND (last_depreciation_date IS NULL 
       OR last_depreciation_date < DATE_TRUNC('month', CURRENT_DATE));
```

---

### 6. v_payroll_summary

**Purpose:** Payroll summary by period with statutory deductions.

**Columns:**
- `payroll_run_id` — Payroll run UUID
- `period_start`, `period_end` — Payroll period
- `status` — Payroll run status
- `context` — Business/personal
- `employee_count` — Number of employees paid
- `total_gross` — Total gross salaries
- `total_deductions` — Total deductions
- `total_net` — Total net pay
- `total_paye` — Total PAYE tax
- `total_uif` — Total UIF (1% of gross, max R177.12)
- `total_sdl` — Total SDL (1% of gross for business)
- `processed_at` — When processed
- `processed_by` — Who processed

**SA Statutory Calculations:**
- **UIF:** 1% of gross salary, capped at R177.12 per month (employee + employer)
- **SDL:** 1% of gross payroll (employer only, business context)
- **PAYE:** From payslips.tax_amount (complex progressive tax calculation)

**Example Query:**
```sql
-- Current month payroll
SELECT
  period_start, period_end, employee_count,
  total_gross, total_paye, total_uif, total_sdl, total_net
FROM v_payroll_summary
WHERE period_start = DATE_TRUNC('month', CURRENT_DATE)::date;

-- Annual payroll summary
SELECT
  EXTRACT(YEAR FROM period_start) as year,
  SUM(total_gross) as annual_gross,
  SUM(total_paye) as annual_paye,
  SUM(total_uif) as annual_uif,
  SUM(total_sdl) as annual_sdl
FROM v_payroll_summary
WHERE context = 'business'
GROUP BY EXTRACT(YEAR FROM period_start)
ORDER BY year DESC;
```

---

### 7. v_financial_health

**Purpose:** Financial health ratios and metrics.

**Columns:**
- `context` — Business/personal
- `currency` — Currency code
- `current_assets` — Total current assets
- `total_assets` — Total assets
- `current_liabilities` — Total current liabilities
- `total_liabilities` — Total liabilities
- `total_equity` — Total equity
- `current_ratio` — Current Assets / Current Liabilities
- `quick_ratio` — (Current Assets - Inventory) / Current Liabilities
- `debt_to_equity_ratio` — Total Liabilities / Total Equity
- `working_capital` — Current Assets - Current Liabilities
- `equity_ratio` — Total Equity / Total Assets

**Financial Ratios Explained:**

**Current Ratio:**
- Formula: Current Assets / Current Liabilities
- Good: > 1.5 (can cover short-term obligations)
- Warning: < 1.0 (liquidity issues)

**Quick Ratio (Acid Test):**
- Formula: (Current Assets - Inventory) / Current Liabilities
- Good: > 1.0 (can cover without selling inventory)
- Warning: < 0.5 (serious liquidity concerns)

**Debt-to-Equity:**
- Formula: Total Liabilities / Total Equity
- Good: < 1.0 (equity exceeds debt)
- Warning: > 2.0 (highly leveraged)

**Working Capital:**
- Formula: Current Assets - Current Liabilities
- Positive = Good (can operate)
- Negative = Warning (cash flow issues)

**Example Query:**
```sql
-- Business financial health
SELECT
  current_ratio,
  quick_ratio,
  debt_to_equity_ratio,
  working_capital
FROM v_financial_health
WHERE context = 'business' AND currency = 'ZAR';
```

---

### 8. v_financial_dashboard

**Purpose:** Financial dashboard with key KPIs pulling from multiple sources.

**Columns:**
- `current_month` — Current month (first day)
- `currency` — Currency code
- `cash_on_hand` — Total bank account balances
- `current_month_revenue` — Revenue this month
- `current_month_expenses` — Expenses this month
- `current_month_profit` — Revenue - Expenses
- `previous_month_revenue` — Last month revenue
- `previous_month_expenses` — Last month expenses
- `ytd_revenue` — Year-to-date revenue
- `ytd_expenses` — Year-to-date expenses
- `outstanding_receivables` — Total unpaid invoices
- `outstanding_payables` — Total unpaid bills
- `net_position` — Cash + Receivables - Payables

**Data Sources:**
- Cash: `bank_accounts.current_balance`
- Revenue/Expenses: `financial_transactions`
- Receivables: `invoices` (sent/overdue/partially_paid)
- Payables: `supplier_bills` (received/overdue/partially_paid)

**Example Query:**
```sql
-- Executive dashboard
SELECT
  currency,
  cash_on_hand,
  current_month_profit,
  ytd_revenue,
  ytd_expenses,
  ytd_revenue - ytd_expenses as ytd_profit,
  net_position
FROM v_financial_dashboard
WHERE currency = 'ZAR';

-- Month-over-month comparison
SELECT
  currency,
  current_month_revenue,
  previous_month_revenue,
  current_month_revenue - previous_month_revenue as revenue_change,
  ROUND(
    (current_month_revenue - previous_month_revenue) / NULLIF(previous_month_revenue, 0) * 100,
    2
  ) as revenue_change_pct
FROM v_financial_dashboard
WHERE currency = 'ZAR';
```

---

## Use Cases

### Payroll Processing

**Monthly Payroll Run:**

```sql
-- 1. Create payroll run
INSERT INTO payroll_runs (period_start, period_end, status)
VALUES ('2024-02-01', '2024-02-29', 'draft')
RETURNING id;

-- 2. Generate payslips for all active employees
INSERT INTO payslips (payroll_run_id, employee_id, gross_amount, deductions, net_amount, tax_amount)
SELECT
  'payroll-run-uuid',
  id,
  salary,
  jsonb_build_object(
    'paye', salary * 0.25,
    'uif', LEAST(salary * 0.01, 177.12),
    'pension', salary * 0.075
  ),
  salary - (salary * 0.25 + LEAST(salary * 0.01, 177.12) + salary * 0.075),
  salary * 0.25
FROM employees
WHERE status = 'active';

-- 3. Update payroll run totals
UPDATE payroll_runs pr
SET
  total_gross = (SELECT SUM(gross_amount) FROM payslips WHERE payroll_run_id = pr.id),
  total_deductions = (SELECT SUM(gross_amount - net_amount) FROM payslips WHERE payroll_run_id = pr.id),
  total_net = (SELECT SUM(net_amount) FROM payslips WHERE payroll_run_id = pr.id)
WHERE id = 'payroll-run-uuid';

-- 4. Process payroll
UPDATE payroll_runs
SET status = 'processed', processed_at = now(), processed_by = 'system'
WHERE id = 'payroll-run-uuid';

-- 5. View summary
SELECT * FROM v_payroll_summary WHERE payroll_run_id = 'payroll-run-uuid';
```

---

### Monthly Financial Close

**Month-End Checklist:**

```sql
-- 1. Run depreciation
-- (Calculate and record depreciation for all active assets)

-- 2. Review trial balance
SELECT * FROM v_trial_balance
WHERE context = 'business' AND currency = 'ZAR'
ORDER BY code;

-- 3. Verify debits = credits
SELECT
  SUM(total_debits) - SUM(total_credits) as difference
FROM v_trial_balance;
-- Should be 0.00

-- 4. Generate VAT return
SELECT * FROM v_vat_return
WHERE period = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date;

-- 5. Review aging reports
SELECT * FROM v_payables_aging WHERE currency = 'ZAR';

-- 6. Generate financial statements
SELECT * FROM v_balance_sheet WHERE context = 'business';
SELECT * FROM v_financial_health WHERE context = 'business';

-- 7. Financial dashboard review
SELECT * FROM v_financial_dashboard WHERE currency = 'ZAR';
```

---

### Multi-Currency Reporting

**Convert amounts between currencies:**

```sql
-- Get latest rate
CREATE OR REPLACE FUNCTION convert_currency(
  amount NUMERIC,
  from_curr TEXT,
  to_curr TEXT
) RETURNS NUMERIC AS $$
  SELECT amount * rate
  FROM currency_rates
  WHERE base_currency = from_curr
    AND target_currency = to_curr
  ORDER BY effective_date DESC
  LIMIT 1;
$$ LANGUAGE SQL;

-- Example: Convert R10,000 ZAR to USD
SELECT convert_currency(10000, 'ZAR', 'USD');
-- Returns ~540.00

-- Consolidated balance sheet (all currencies in ZAR)
SELECT
  account_type,
  SUM(
    CASE
      WHEN currency = 'ZAR' THEN current_balance
      ELSE convert_currency(current_balance, currency, 'ZAR')
    END
  ) as total_zar
FROM v_balance_sheet
WHERE context = 'business'
GROUP BY account_type;
```

---

## RLS & Realtime

**Row Level Security:** ✅ Enabled with open policies
**Realtime:** ✅ Enabled on all 5 tables

**Tables:**
- employees
- payroll_runs
- payslips
- currency_rates
- petty_cash

---

## Next Steps

### Immediate
- [ ] Create employees for your organization
- [ ] Set up payroll runs
- [ ] Update currency rates regularly
- [ ] Start recording petty cash transactions

### Short-term
- [ ] Build UI for payroll processing
- [ ] Implement PAYE calculation (SA tax tables)
- [ ] Automated depreciation runs (monthly cron)
- [ ] Currency rate API integration
- [ ] Financial statement PDFs

### Long-term
- [ ] Multi-company consolidation
- [ ] Budget vs actual variance analysis
- [ ] Cash flow forecasting
- [ ] Payroll journal entries (auto-post to GL)
- [ ] IRP5 tax certificate generation
- [ ] UIF/SDL submission files

---

**This is FINANCE. Every ratio matters. Every view must be accurate.**
