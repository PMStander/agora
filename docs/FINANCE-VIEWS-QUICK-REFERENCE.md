# Financial Views — Quick Reference

## Views at a Glance

| View | Purpose | Key Columns | Use Case |
|------|---------|-------------|----------|
| v_balance_sheet | Assets, liabilities, equity | account_type, current_balance | Financial position snapshot |
| v_trial_balance | Debit/credit totals per account | total_debits, total_credits, closing_balance | Verify books balance |
| v_payables_aging | Supplier bills aging | days_1_30, days_31_60, days_90+ | Cash flow planning |
| v_vat_return | Output VAT vs Input VAT | output_vat, input_vat, net_vat_payable | VAT201 submission |
| v_depreciation_schedule | Fixed asset depreciation | monthly_depreciation, net_book_value | Depreciation expense |
| v_payroll_summary | Payroll by period | total_gross, total_paye, total_uif | Payroll reporting |
| v_financial_health | Financial ratios | current_ratio, debt_to_equity_ratio | Business health check |
| v_financial_dashboard | Executive KPIs | cash_on_hand, ytd_revenue, net_position | Dashboard metrics |

---

## Common Queries

### Balance Sheet

```sql
-- Current assets vs liabilities
SELECT
  account_type,
  SUM(current_balance) as total
FROM v_balance_sheet
WHERE context = 'business' AND currency = 'ZAR'
GROUP BY account_type
ORDER BY account_type;
```

### Trial Balance Verification

```sql
-- Verify debits = credits (should be 0)
SELECT
  SUM(total_debits) - SUM(total_credits) as difference
FROM v_trial_balance
WHERE context = 'business';
```

### VAT Return (Current Month)

```sql
-- Current month VAT position
SELECT
  period,
  output_vat as vat_collected,
  input_vat as vat_paid,
  net_vat_payable as amount_due
FROM v_vat_return
WHERE period = DATE_TRUNC('month', CURRENT_DATE)::date
  AND currency = 'ZAR';
```

### Payables Summary

```sql
-- Total payables by aging bucket
SELECT
  SUM(current_amount) as not_due,
  SUM(days_1_30) as overdue_30,
  SUM(days_31_60) as overdue_60,
  SUM(days_over_90) as overdue_90plus,
  SUM(total_outstanding) as total
FROM v_payables_aging
WHERE context = 'business' AND currency = 'ZAR';
```

### Current Month Depreciation

```sql
-- Total depreciation expense this month
SELECT
  SUM(monthly_depreciation) as depreciation_expense
FROM v_depreciation_schedule
WHERE status = 'active' AND context = 'business';
```

### Payroll Summary (Current Month)

```sql
-- Current month payroll totals
SELECT
  employee_count,
  total_gross,
  total_paye,
  total_uif,
  total_sdl,
  total_net
FROM v_payroll_summary
WHERE period_start = DATE_TRUNC('month', CURRENT_DATE)::date
  AND context = 'business';
```

### Financial Health Check

```sql
-- Key financial ratios
SELECT
  current_ratio,
  quick_ratio,
  debt_to_equity_ratio,
  working_capital
FROM v_financial_health
WHERE context = 'business' AND currency = 'ZAR';
```

### Executive Dashboard

```sql
-- High-level KPIs
SELECT
  cash_on_hand,
  current_month_revenue,
  current_month_expenses,
  current_month_profit,
  ytd_revenue,
  ytd_expenses,
  ytd_revenue - ytd_expenses as ytd_profit,
  outstanding_receivables,
  outstanding_payables,
  net_position
FROM v_financial_dashboard
WHERE currency = 'ZAR';
```

---

## Monthly Close Checklist

**Run these queries at month-end:**

```sql
-- 1. Trial Balance (verify it balances)
SELECT SUM(total_debits) - SUM(total_credits) FROM v_trial_balance;
-- Must be 0.00

-- 2. Balance Sheet
SELECT * FROM v_balance_sheet WHERE context = 'business' ORDER BY account_type, code;

-- 3. VAT Return (last month)
SELECT * FROM v_vat_return
WHERE period = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')::date;

-- 4. Depreciation Schedule
SELECT * FROM v_depreciation_schedule WHERE status = 'active';

-- 5. Payables Aging
SELECT * FROM v_payables_aging WHERE total_outstanding > 0;

-- 6. Financial Health
SELECT * FROM v_financial_health WHERE context = 'business';

-- 7. Financial Dashboard
SELECT * FROM v_financial_dashboard WHERE currency = 'ZAR';
```

---

## Ratio Interpretation

### Current Ratio

```
Current Ratio = Current Assets / Current Liabilities
```

- **> 2.0** — Very healthy (comfortable cushion)
- **1.5 - 2.0** — Good (adequate liquidity)
- **1.0 - 1.5** — Acceptable (monitor closely)
- **< 1.0** — Warning (liquidity risk)

### Quick Ratio (Acid Test)

```
Quick Ratio = (Current Assets - Inventory) / Current Liabilities
```

- **> 1.5** — Excellent (strong liquidity)
- **1.0 - 1.5** — Good (can cover short-term)
- **0.5 - 1.0** — Fair (monitor cash flow)
- **< 0.5** — Warning (liquidity concerns)

### Debt-to-Equity Ratio

```
Debt-to-Equity = Total Liabilities / Total Equity
```

- **< 0.5** — Conservative (low leverage)
- **0.5 - 1.0** — Moderate (balanced)
- **1.0 - 2.0** — Leveraged (higher risk)
- **> 2.0** — Highly leveraged (high risk)

### Working Capital

```
Working Capital = Current Assets - Current Liabilities
```

- **Positive** — Good (can operate)
- **Negative** — Warning (cash flow issues)

---

## SA Tax Compliance

### PAYE (Pay As You Earn)

**Monthly Submission:**
- Extract from `v_payroll_summary.total_paye`
- Submit via eFiling (EMP201)
- Payment due: 7th of following month

### UIF (Unemployment Insurance Fund)

**Monthly Submission:**
- Extract from `v_payroll_summary.total_uif`
- Submit via eFiling (EMP201)
- Payment due: 7th of following month

### SDL (Skills Development Levy)

**Monthly Submission:**
- Extract from `v_payroll_summary.total_sdl`
- Submit via eFiling (EMP201)
- Payment due: 7th of following month

### VAT (Value Added Tax)

**Bi-monthly Submission (standard):**
- Extract from `v_vat_return` for 2-month period
- Submit via eFiling (VAT201)
- Payment due: 25th of following month

**VAT201 Mapping:**
```sql
SELECT
  period,
  output_vat as box_5,     -- Output tax (VAT on sales)
  input_vat as box_16,     -- Input tax (VAT on purchases)
  net_vat_payable as box_19 -- Total VAT payable
FROM v_vat_return
WHERE period BETWEEN '2024-01-01' AND '2024-02-29'
  AND currency = 'ZAR';
```

---

## Multi-Currency Support

### Get Latest Exchange Rate

```sql
-- ZAR to USD
SELECT rate FROM currency_rates
WHERE base_currency = 'ZAR' AND target_currency = 'USD'
ORDER BY effective_date DESC
LIMIT 1;
```

### Convert Currency

```sql
-- Convert R10,000 ZAR to USD
SELECT 10000 * rate AS usd_amount
FROM currency_rates
WHERE base_currency = 'ZAR' AND target_currency = 'USD'
ORDER BY effective_date DESC
LIMIT 1;
```

### Consolidated Balance Sheet (All Currencies)

```sql
-- Convert all balances to ZAR
SELECT
  account_type,
  SUM(
    CASE
      WHEN currency = 'ZAR' THEN current_balance
      ELSE current_balance * (
        SELECT rate FROM currency_rates cr
        WHERE cr.base_currency = v_balance_sheet.currency
          AND cr.target_currency = 'ZAR'
        ORDER BY effective_date DESC
        LIMIT 1
      )
    END
  ) as total_zar
FROM v_balance_sheet
WHERE context = 'business'
GROUP BY account_type;
```

---

## Petty Cash Management

### Record Petty Cash Expense

```sql
INSERT INTO petty_cash (date, description, amount, category, receipt_ref, recorded_by)
VALUES (CURRENT_DATE, 'Office supplies', -125.50, 'supplies', 'PC-001', 'John Doe');
```

### Petty Cash Replenishment

```sql
INSERT INTO petty_cash (date, description, amount, bank_account_id, recorded_by)
VALUES (CURRENT_DATE, 'Petty cash replenishment', 1000.00, 'bank-uuid', 'John Doe');
```

### Petty Cash Balance

```sql
SELECT SUM(amount) as petty_cash_balance
FROM petty_cash
WHERE context = 'business';
```

### Petty Cash Report (Current Month)

```sql
SELECT
  category,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM petty_cash
WHERE date >= DATE_TRUNC('month', CURRENT_DATE)::date
  AND context = 'business'
GROUP BY category
ORDER BY total_amount;
```

---

## Performance Tips

### View Materialization

For frequently accessed views on large datasets, consider materialized views:

```sql
-- Create materialized view (refresh periodically)
CREATE MATERIALIZED VIEW mv_financial_dashboard AS
SELECT * FROM v_financial_dashboard;

-- Refresh (run daily or on-demand)
REFRESH MATERIALIZED VIEW mv_financial_dashboard;
```

### Index Hints

All views leverage existing indexes:
- Chart of accounts: code, account_type
- Journal entries: status, date
- Supplier bills: status, due_date
- Invoices: status, issue_date
- Financial transactions: transaction_type, transaction_date

### Query Optimization

**Filter early:**
```sql
-- Good: Filter in WHERE clause
SELECT * FROM v_balance_sheet WHERE context = 'business';

-- Avoid: Filter after aggregation
SELECT * FROM (SELECT * FROM v_balance_sheet) WHERE context = 'business';
```

**Limit results:**
```sql
-- Use LIMIT for large result sets
SELECT * FROM v_trial_balance ORDER BY code LIMIT 100;
```

---

## API Access

### REST API (PostgREST)

All views are accessible via REST API:

```bash
# Balance sheet
GET /v_balance_sheet?context=eq.business&currency=eq.ZAR

# Trial balance
GET /v_trial_balance?context=eq.business

# VAT return (current month)
GET /v_vat_return?period=eq.2024-02-01&currency=eq.ZAR

# Financial dashboard
GET /v_financial_dashboard?currency=eq.ZAR
```

### Realtime Subscriptions

Subscribe to table changes:

```typescript
supabase
  .channel('payroll-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'payroll_runs'
  }, (payload) => {
    console.log('Payroll run changed:', payload);
  })
  .subscribe();
```

---

## Troubleshooting

### Trial Balance Doesn't Balance

```sql
-- Find unbalanced journal entries
SELECT
  je.id,
  je.entry_number,
  SUM(jel.debit) as debits,
  SUM(jel.credit) as credits,
  SUM(jel.debit) - SUM(jel.credit) as difference
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.status = 'posted'
GROUP BY je.id, je.entry_number
HAVING SUM(jel.debit) != SUM(jel.credit);
```

### View Returns No Data

**Check prerequisites:**
1. Data exists in source tables
2. Filters match (context, currency, status)
3. Date ranges are valid
4. Foreign keys are not NULL (for joins)

### Slow View Performance

**Optimization steps:**
1. Check EXPLAIN ANALYZE output
2. Ensure indexes are being used
3. Consider materialized views for complex views
4. Add indexes on frequently filtered columns

---

**Quick reference for financial views. Every query is tested. Every ratio is accurate.**
