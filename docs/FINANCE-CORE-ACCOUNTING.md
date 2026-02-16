# Core Accounting System

## Overview

Comprehensive double-entry accounting system for Agora with South African chart of accounts, journal entries, fixed asset management, accounts payable, and purchase order tracking.

## Database Schema

### 1. Chart of Accounts

**Table:** `chart_of_accounts`

Standard South African chart of accounts with hierarchical structure.

**Fields:**
- `id` — UUID primary key
- `code` — TEXT UNIQUE (e.g., "1100", "4000")
- `name` — Account name
- `account_type` — ENUM ('asset', 'liability', 'equity', 'revenue', 'expense')
- `sub_type` — TEXT (e.g., 'current', 'fixed', 'operating')
- `parent_id` — UUID self-reference for hierarchy
- `is_system` — BOOLEAN (system accounts cannot be deleted)
- `balance` — NUMERIC(15,2) current account balance
- `currency` — TEXT (default 'ZAR')
- `context` — ENUM ('business', 'personal')
- `notes` — TEXT
- `created_at`, `updated_at` — Timestamps

**Account Number Ranges (SA Standard):**
- 1000-1999: Assets
- 2000-2999: Liabilities
- 3000-3999: Equity
- 4000-4999: Revenue
- 5000-9999: Expenses

**Seeded Accounts:**
- **Assets:** Cash, Bank Accounts, Trade Debtors, Inventory, Fixed Assets, Depreciation
- **Liabilities:** Trade Creditors, VAT Output, PAYE/UIF/SDL, Loans
- **Equity:** Share Capital, Retained Earnings, Drawings
- **Revenue:** Sales, Service, Interest, Rental, Other Income
- **Expenses:** COGS, Salaries, Rent, Utilities, Marketing, Depreciation, etc.

**Example:**
```sql
SELECT code, name, account_type, balance
FROM chart_of_accounts
WHERE account_type = 'asset'
  AND context = 'business'
ORDER BY code;
```

---

### 2. Journal Entries

**Tables:** `journal_entries`, `journal_entry_lines`

Double-entry bookkeeping with automatic balance validation.

**journal_entries:**
- `id` — UUID
- `entry_number` — TEXT UNIQUE (e.g., "JE-2024-001")
- `entry_date` — DATE
- `description` — TEXT
- `reference` — TEXT (optional reference number)
- `status` — ENUM ('draft', 'posted', 'void')
- `posted_by` — TEXT (user who posted)
- `context` — ENUM ('business', 'personal')
- `created_at`, `updated_at`

**journal_entry_lines:**
- `id` — UUID
- `journal_entry_id` — FK to journal_entries
- `account_id` — FK to chart_of_accounts
- `debit` — NUMERIC(15,2) (≥ 0)
- `credit` — NUMERIC(15,2) (≥ 0)
- `description` — TEXT
- `contact_id` — FK to contacts (optional)
- `company_id` — FK to companies (optional)
- `created_at`

**Constraints:**
- Each line must have EITHER debit OR credit (not both)
- When entry status is 'posted': total debits MUST equal total credits
- Trigger `validate_journal_entry_balance()` enforces balance

**Example:**
```sql
-- Create journal entry
INSERT INTO journal_entries (entry_number, entry_date, description, status)
VALUES ('JE-2024-001', '2024-02-13', 'Office supplies purchase', 'draft')
RETURNING id;

-- Add lines (debits = credits)
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
VALUES
  -- Debit: Office Supplies Expense
  ('entry-uuid', 'account-6600-uuid', 500.00, 0, 'Office supplies'),
  -- Credit: Bank Account
  ('entry-uuid', 'account-1100-uuid', 0, 500.00, 'Payment from bank');

-- Post entry (triggers balance validation)
UPDATE journal_entries SET status = 'posted' WHERE id = 'entry-uuid';
```

---

### 3. Fixed Assets

**Tables:** `fixed_assets`, `asset_depreciation_log`

Track capital assets with automatic depreciation.

**fixed_assets:**
- `id` — UUID
- `name` — Asset name
- `asset_code` — TEXT UNIQUE (e.g., "VEH-001")
- `category` — ENUM ('land', 'buildings', 'vehicles', 'equipment', 'furniture', 'computers', 'intangible', 'other')
- `purchase_date` — DATE
- `purchase_price` — NUMERIC(15,2)
- `current_value` — NUMERIC(15,2)
- `salvage_value` — NUMERIC(15,2)
- `useful_life_months` — INT
- `depreciation_method` — ENUM ('straight_line', 'reducing_balance', 'none')
- `accumulated_depreciation` — NUMERIC(15,2)
- `last_depreciation_date` — DATE
- `disposal_date` — DATE (when sold/scrapped)
- `disposal_amount` — NUMERIC(15,2)
- `status` — ENUM ('active', 'disposed', 'fully_depreciated', 'written_off')
- `account_id` — FK to chart_of_accounts
- `supplier_id` — FK to contacts
- `notes`, `context`, timestamps

**asset_depreciation_log:**
- `id` — UUID
- `asset_id` — FK to fixed_assets
- `period_date` — DATE (depreciation period)
- `amount` — NUMERIC(15,2) (depreciation amount)
- `method` — ENUM depreciation method used
- `created_at`

**Depreciation Methods:**
- **Straight Line:** `(purchase_price - salvage_value) / useful_life_months`
- **Reducing Balance:** `current_value * (rate / 12)` — typical rate 20-40%
- **None:** No depreciation (e.g., land)

**Example:**
```sql
-- Register new vehicle
INSERT INTO fixed_assets (
  name, asset_code, category, purchase_date, purchase_price,
  salvage_value, useful_life_months, depreciation_method, status, context
) VALUES (
  'Toyota Hilux 2024', 'VEH-001', 'vehicles', '2024-01-15', 450000.00,
  90000.00, 60, 'straight_line', 'active', 'business'
);

-- Monthly depreciation: (450,000 - 90,000) / 60 = R6,000/month

-- Log depreciation entry
INSERT INTO asset_depreciation_log (asset_id, period_date, amount, method)
VALUES ('asset-uuid', '2024-02-28', 6000.00, 'straight_line');

-- Update accumulated depreciation
UPDATE fixed_assets
SET accumulated_depreciation = accumulated_depreciation + 6000.00,
    last_depreciation_date = '2024-02-28'
WHERE id = 'asset-uuid';
```

---

### 4. Accounts Payable (Supplier Bills)

**Tables:** `supplier_bills`, `supplier_bill_line_items`, `supplier_bill_payments`

Track money owed to suppliers.

**supplier_bills:**
- `id` — UUID
- `bill_number` — TEXT UNIQUE
- `supplier_id` — FK to contacts
- `company_id` — FK to companies
- `status` — ENUM ('draft', 'received', 'approved', 'partially_paid', 'paid', 'overdue', 'void')
- `issue_date` — DATE
- `due_date` — DATE
- `subtotal` — NUMERIC(15,2)
- `tax_total` — NUMERIC(15,2)
- `total` — NUMERIC(15,2)
- `amount_paid` — NUMERIC(15,2)
- `currency`, `reference`, `notes`, `context`, timestamps

**supplier_bill_line_items:**
- `id` — UUID
- `bill_id` — FK to supplier_bills
- `description` — TEXT
- `quantity` — NUMERIC(12,3)
- `unit_price` — NUMERIC(15,2)
- `tax_rate_id` — FK to tax_rates
- `line_total` — NUMERIC(15,2)
- `account_id` — FK to chart_of_accounts (expense account)
- `created_at`

**supplier_bill_payments:**
- `id` — UUID
- `bill_id` — FK to supplier_bills
- `amount` — NUMERIC(15,2)
- `payment_date` — DATE
- `payment_method` — TEXT
- `reference` — TEXT
- `bank_account_id` — FK to bank_accounts
- `transaction_id` — FK to financial_transactions
- `created_at`

**Status Flow:**
draft → received → approved → partially_paid → paid

**Example:**
```sql
-- Receive supplier bill
INSERT INTO supplier_bills (
  bill_number, supplier_id, status, issue_date, due_date,
  subtotal, tax_total, total, currency, context
) VALUES (
  'INV-2024-1234', 'supplier-uuid', 'received', '2024-02-10', '2024-03-10',
  10000.00, 1500.00, 11500.00, 'ZAR', 'business'
) RETURNING id;

-- Add line items
INSERT INTO supplier_bill_line_items (
  bill_id, description, quantity, unit_price, line_total, account_id
) VALUES
  ('bill-uuid', 'Office furniture', 1, 10000.00, 10000.00, 'account-6600-uuid');

-- Record payment
INSERT INTO supplier_bill_payments (
  bill_id, amount, payment_date, payment_method, bank_account_id
) VALUES ('bill-uuid', 11500.00, '2024-02-20', 'EFT', 'bank-uuid');

-- Update bill status
UPDATE supplier_bills
SET amount_paid = 11500.00, status = 'paid'
WHERE id = 'bill-uuid';
```

---

### 5. Purchase Orders

**Tables:** `purchase_orders`, `purchase_order_line_items`

Track orders placed with suppliers before goods are received.

**purchase_orders:**
- `id` — UUID
- `po_number` — TEXT UNIQUE (e.g., "PO-2024-001")
- `supplier_id` — FK to contacts
- `status` — ENUM ('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled')
- `issue_date` — DATE
- `expected_date` — DATE (expected delivery)
- `subtotal`, `tax_total`, `total` — NUMERIC(15,2)
- `currency`, `notes`, `context`, timestamps

**purchase_order_line_items:**
- `id` — UUID
- `po_id` — FK to purchase_orders
- `product_id` — UUID nullable (FK to products if exists)
- `description` — TEXT
- `quantity` — NUMERIC(12,3)
- `unit_price` — NUMERIC(15,2)
- `received_quantity` — NUMERIC(12,3) (default 0)
- `created_at`

**Constraint:** `received_quantity ≤ quantity`

**Status Flow:**
draft → sent → confirmed → partially_received → received

**Example:**
```sql
-- Create PO
INSERT INTO purchase_orders (
  po_number, supplier_id, status, issue_date, expected_date,
  subtotal, tax_total, total, currency, context
) VALUES (
  'PO-2024-001', 'supplier-uuid', 'draft', '2024-02-13', '2024-02-20',
  5000.00, 750.00, 5750.00, 'ZAR', 'business'
) RETURNING id;

-- Add line items
INSERT INTO purchase_order_line_items (
  po_id, description, quantity, unit_price
) VALUES
  ('po-uuid', 'Dell Monitors', 2, 2500.00);

-- Mark as sent
UPDATE purchase_orders SET status = 'sent' WHERE id = 'po-uuid';

-- Record partial receipt
UPDATE purchase_order_line_items
SET received_quantity = 1
WHERE po_id = 'po-uuid' AND description = 'Dell Monitors';

UPDATE purchase_orders SET status = 'partially_received' WHERE id = 'po-uuid';
```

---

### 6. Financial Periods

**Table:** `financial_periods`

Define fiscal year periods for accounting (SA uses March-February tax year).

**Fields:**
- `id` — UUID
- `name` — TEXT (e.g., "FY 2024/2025")
- `start_date` — DATE
- `end_date` — DATE
- `status` — ENUM ('open', 'closed', 'locked')
- `context` — ENUM ('business', 'personal')
- `closed_by` — TEXT (who closed the period)
- `closed_at` — TIMESTAMPTZ
- `created_at`, `updated_at`

**Seeded Periods:**
- FY 2023/2024: 2023-03-01 to 2024-02-29 (closed)
- FY 2024/2025: 2024-03-01 to 2025-02-28 (open)
- FY 2025/2026: 2025-03-01 to 2026-02-28 (open)

**Period Statuses:**
- **open** — Transactions can be added/edited
- **closed** — Period is closed but can be reopened
- **locked** — Period is locked, cannot be reopened (after audit/SARS submission)

**Example:**
```sql
-- Get current open period
SELECT * FROM financial_periods
WHERE status = 'open'
  AND CURRENT_DATE BETWEEN start_date AND end_date;

-- Close financial year
UPDATE financial_periods
SET status = 'closed',
    closed_by = 'system',
    closed_at = now()
WHERE name = 'FY 2023/2024';
```

---

### 7. Audit Trail (Financial Transactions)

**Enhanced Table:** `financial_transactions` (existing table)

**New Audit Columns:**
- `locked` — BOOLEAN (default false)
- `locked_at` — TIMESTAMPTZ
- `locked_by` — TEXT

**Purpose:** Once transactions are reconciled/audited, they can be locked to prevent modification.

**Example:**
```sql
-- Lock reconciled transactions
UPDATE financial_transactions
SET locked = true,
    locked_at = now(),
    locked_by = 'accountant@company.com'
WHERE status = 'reconciled'
  AND transaction_date < '2024-03-01';

-- Prevent modification of locked transactions (application logic)
SELECT * FROM financial_transactions
WHERE id = 'tx-uuid' AND locked = false
FOR UPDATE; -- Only succeed if unlocked
```

---

## Key Constraints

### 1. Journal Entry Balance
**Trigger:** `validate_journal_entry_balance()`

When a journal entry is in 'posted' status, total debits MUST equal total credits. Enforced at line insert/update.

### 2. Supplier Bill Payments
`amount_paid ≤ total` — Cannot overpay a bill

### 3. Purchase Order Receipts
`received_quantity ≤ quantity` — Cannot receive more than ordered

### 4. Journal Entry Lines
Each line must have EITHER debit OR credit (not both, not neither)

### 5. Asset Status
- Assets in 'disposed' status must have `disposal_date` and `disposal_amount`
- Assets in 'fully_depreciated' status have `accumulated_depreciation ≥ (purchase_price - salvage_value)`

---

## Indexes

All tables have indexes on:
- Foreign keys (for join performance)
- Status fields (for filtering)
- Date fields (for reporting)
- Context field (business/personal separation)

**Critical Indexes:**
```sql
idx_chart_of_accounts_code
idx_journal_entries_date
idx_fixed_assets_status
idx_supplier_bills_due_date
idx_purchase_orders_supplier
idx_financial_periods_dates
idx_financial_transactions_locked
```

---

## RLS (Row Level Security)

All tables have RLS enabled with **open policies** (allow all).

**Production Recommendation:** Implement user-based policies before production:
```sql
-- Example: User can only see their own context
CREATE POLICY "Users see own context"
  ON chart_of_accounts
  FOR SELECT
  USING (context = current_setting('app.user_context')::text);
```

---

## Realtime

All tables are added to `supabase_realtime` publication for live updates.

Subscribe in application:
```typescript
const subscription = supabase
  .channel('accounting-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'journal_entries'
  }, (payload) => {
    console.log('Journal entry changed:', payload);
  })
  .subscribe();
```

---

## Common Queries

### Balance Sheet (Assets, Liabilities, Equity)

```sql
SELECT
  account_type,
  SUM(balance) AS total_balance
FROM chart_of_accounts
WHERE account_type IN ('asset', 'liability', 'equity')
  AND context = 'business'
GROUP BY account_type;
```

### Profit & Loss (Revenue vs Expenses)

```sql
SELECT
  account_type,
  SUM(balance) AS total
FROM chart_of_accounts
WHERE account_type IN ('revenue', 'expense')
  AND context = 'business'
GROUP BY account_type;
```

### Aging Payables (Supplier Bills)

```sql
SELECT
  supplier_id,
  COUNT(*) AS bill_count,
  SUM(total - amount_paid) AS outstanding,
  MIN(due_date) AS oldest_due_date,
  CASE
    WHEN MIN(due_date) < CURRENT_DATE THEN 'Overdue'
    WHEN MIN(due_date) <= CURRENT_DATE + INTERVAL '7 days' THEN 'Due Soon'
    ELSE 'Current'
  END AS urgency
FROM supplier_bills
WHERE status IN ('received', 'approved', 'partially_paid', 'overdue')
  AND amount_paid < total
GROUP BY supplier_id;
```

### Asset Depreciation Summary

```sql
SELECT
  category,
  COUNT(*) AS asset_count,
  SUM(purchase_price) AS total_cost,
  SUM(accumulated_depreciation) AS total_depreciation,
  SUM(purchase_price - accumulated_depreciation) AS net_book_value
FROM fixed_assets
WHERE status = 'active'
  AND context = 'business'
GROUP BY category;
```

### Monthly Depreciation Schedule

```sql
SELECT
  fa.name,
  fa.category,
  fa.purchase_price,
  fa.accumulated_depreciation,
  (fa.purchase_price - fa.salvage_value) / fa.useful_life_months AS monthly_depreciation,
  fa.useful_life_months - 
    EXTRACT(MONTH FROM age(CURRENT_DATE, fa.purchase_date))::int AS months_remaining
FROM fixed_assets fa
WHERE fa.status = 'active'
  AND fa.depreciation_method != 'none'
ORDER BY monthly_depreciation DESC;
```

---

## Integration with Existing Tables

### Links to Existing Schema

- **contacts** — Used for suppliers, customers, payees
- **companies** — Used for supplier/customer companies
- **bank_accounts** — Used for payments
- **tax_rates** — Used for VAT/GST on bills and POs
- **financial_transactions** — Enhanced with audit trail, linked from bill payments

### Creating Linked Records

**Example: Supplier Bill → Financial Transaction**

```sql
-- 1. Create supplier bill payment
INSERT INTO supplier_bill_payments (bill_id, amount, payment_date, payment_method, bank_account_id)
VALUES ('bill-uuid', 11500.00, CURRENT_DATE, 'EFT', 'bank-uuid')
RETURNING id;

-- 2. Create matching financial transaction
INSERT INTO financial_transactions (
  transaction_type, status, amount, currency,
  bank_account_id, payee_contact_id, description,
  transaction_date, reference_number
) VALUES (
  'expense', 'completed', 11500.00, 'ZAR',
  'bank-uuid', 'supplier-uuid', 'Payment for office furniture',
  CURRENT_DATE, 'bill-number'
) RETURNING id;

-- 3. Link payment to transaction
UPDATE supplier_bill_payments
SET transaction_id = 'transaction-uuid'
WHERE id = 'payment-uuid';

-- 4. Create journal entry for double-entry bookkeeping
-- (implement as needed for full accounting integration)
```

---

## Next Steps

### Immediate
1. Run migration: `supabase migration up`
2. Verify seed data: Check chart_of_accounts and financial_periods
3. Test constraints: Try posting unbalanced journal entry (should fail)

### Phase 2 Enhancements
- [ ] Automated depreciation calculation (cron job)
- [ ] Bank reconciliation module
- [ ] Automatic journal entries from invoices/bills
- [ ] Tax reporting views (VAT, PAYE, UIF, SDL)
- [ ] Multi-currency support
- [ ] Budget vs actual tracking
- [ ] Cash flow forecasting
- [ ] Audit log for all changes

### Phase 3 Features
- [ ] Payroll integration
- [ ] Inventory valuation (FIFO/LIFO/Weighted Average)
- [ ] Project accounting (job costing)
- [ ] Consolidated financial statements
- [ ] Inter-company eliminations
- [ ] Fixed asset register with barcode scanning

---

## South African Compliance Notes

### Tax Year
- March 1 to February 28/29
- Financial periods seeded accordingly

### VAT
- Standard rate: 15% (seeded in tax_rates)
- Account codes: 1500 (VAT Input), 2200 (VAT Output)

### Payroll Deductions
- PAYE (Pay As You Earn): 2300
- UIF (Unemployment Insurance Fund): 2310
- SDL (Skills Development Levy): 2320

### Depreciation
- Straight-line most common for tax purposes
- Rates vary by asset class (consult SARS)
- Land not depreciated (depreciation_method = 'none')

### Chart of Accounts
- Follows IFRS for SMEs structure
- Compatible with SARS eFiling formats
- Expandable for specific industry needs

---

## Troubleshooting

### Journal Entry Won't Post
**Error:** "debits != credits"

**Solution:** Verify line totals:
```sql
SELECT
  journal_entry_id,
  SUM(debit) AS total_debits,
  SUM(credit) AS total_credits,
  SUM(debit) - SUM(credit) AS difference
FROM journal_entry_lines
WHERE journal_entry_id = 'entry-uuid'
GROUP BY journal_entry_id;
```

### Purchase Order Over-Receipt
**Error:** "received_quantity > quantity"

**Solution:** Check line item quantities before update

### Locked Transaction Modification
**Error:** Transaction locked

**Solution:** Check audit trail, unlock if authorized:
```sql
UPDATE financial_transactions
SET locked = false, locked_by = NULL, locked_at = NULL
WHERE id = 'tx-uuid';
```

---

**This is FINANCE. Precision matters. Every rand must balance.**
