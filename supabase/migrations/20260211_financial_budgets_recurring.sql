-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Financial Budgets, Goals, Recurring Items & Cash Flow Forecasting         ║
-- ║  Tables: budgets, financial_goals, goal_contributions,                     ║
-- ║          recurring_items, recurring_item_history                           ║
-- ║  Alters: financial_transactions, bank_accounts, expense_categories         ║
-- ║  Views:  v_budget_vs_actual, v_goal_progress,                             ║
-- ║          v_recurring_status, v_retainer_summary                           ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  1. ALTER EXISTING TABLES                                                  ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- Financial transactions: add recurring link + personal/business context
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS recurring_item_id UUID,
  ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'business'
    CHECK (context IN ('business', 'personal'));

CREATE INDEX IF NOT EXISTS idx_financial_transactions_recurring
  ON financial_transactions(recurring_item_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_context
  ON financial_transactions(context);

-- Bank accounts: add context for personal/business separation
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'business'
    CHECK (context IN ('business', 'personal', 'both'));

-- Expense categories: add default budget template amount
ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS default_budget_amount NUMERIC(15,2);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  2. NEW TABLES                                                             ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 2.1 Budgets ─────────────────────────────────────────────────────────────
-- Per-category budget limits per period (monthly / quarterly / yearly)

CREATE TABLE IF NOT EXISTS budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  period_type     TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start    DATE NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  rollover        BOOLEAN NOT NULL DEFAULT false,
  rollover_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  context         TEXT NOT NULL DEFAULT 'business' CHECK (context IN ('business', 'personal')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, period_type, period_start, currency)
);

CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period   ON budgets(period_start);
CREATE INDEX IF NOT EXISTS idx_budgets_context  ON budgets(context);

-- ─── 2.2 Financial Goals ─────────────────────────────────────────────────────
-- Savings goals, revenue targets, expense reduction targets

CREATE TABLE IF NOT EXISTS financial_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  goal_type       TEXT NOT NULL CHECK (goal_type IN ('savings', 'revenue', 'expense_reduction', 'custom')),
  target_amount   NUMERIC(15,2) NOT NULL,
  current_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  target_date     DATE,
  period_type     TEXT CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'achieved', 'cancelled', 'paused')),
  category_id     UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  color           TEXT,
  icon            TEXT,
  context         TEXT NOT NULL DEFAULT 'business' CHECK (context IN ('business', 'personal')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_goals_status  ON financial_goals(status);
CREATE INDEX IF NOT EXISTS idx_financial_goals_type    ON financial_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_financial_goals_context ON financial_goals(context);

-- ─── 2.3 Goal Contributions ──────────────────────────────────────────────────
-- Links transactions to goals for progress tracking

CREATE TABLE IF NOT EXISTS goal_contributions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id           UUID NOT NULL REFERENCES financial_goals(id) ON DELETE CASCADE,
  transaction_id    UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  amount            NUMERIC(15,2) NOT NULL,
  contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_txn  ON goal_contributions(transaction_id);

-- ─── 2.4 Recurring Items ────────────────────────────────────────────────────
-- Unified table for fixed expenses, recurring income, AND client retainers

CREATE TABLE IF NOT EXISTS recurring_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type               TEXT NOT NULL CHECK (item_type IN ('expense', 'income', 'retainer')),
  name                    TEXT NOT NULL,
  description             TEXT,
  amount                  NUMERIC(15,2) NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'ZAR',
  frequency               TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date              DATE NOT NULL,
  end_date                DATE,
  next_due_date           DATE NOT NULL,

  -- Classification
  category_id             UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  bank_account_id         UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,

  -- Payee / Client
  payee_name              TEXT,
  contact_id              UUID,
  company_id              UUID,

  -- Retainer-specific
  retainer_hours          NUMERIC(8,2),
  hourly_rate             NUMERIC(10,2),

  -- Behavior
  auto_create_transaction BOOLEAN NOT NULL DEFAULT false,
  variance_threshold_pct  NUMERIC(5,2) DEFAULT 10,

  -- Status
  is_active               BOOLEAN NOT NULL DEFAULT true,
  last_generated_at       TIMESTAMPTZ,

  -- Context + metadata
  context                 TEXT NOT NULL DEFAULT 'business' CHECK (context IN ('business', 'personal')),
  tags                    TEXT[],
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_items_type     ON recurring_items(item_type);
CREATE INDEX IF NOT EXISTS idx_recurring_items_next_due ON recurring_items(next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_items_active   ON recurring_items(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_items_company  ON recurring_items(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_items_context  ON recurring_items(context);

-- ─── 2.5 Recurring Item History ──────────────────────────────────────────────
-- Tracks each occurrence/period of a recurring item

CREATE TABLE IF NOT EXISTS recurring_item_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_item_id UUID NOT NULL REFERENCES recurring_items(id) ON DELETE CASCADE,
  expected_date     DATE NOT NULL,
  expected_amount   NUMERIC(15,2) NOT NULL,
  actual_amount     NUMERIC(15,2),
  transaction_id    UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'expected'
                      CHECK (status IN ('expected', 'matched', 'missed', 'skipped')),
  variance_pct      NUMERIC(7,2),
  hours_used        NUMERIC(8,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_history_item   ON recurring_item_history(recurring_item_id);
CREATE INDEX IF NOT EXISTS idx_recurring_history_date   ON recurring_item_history(expected_date);
CREATE INDEX IF NOT EXISTS idx_recurring_history_status ON recurring_item_history(status);

-- FK back from financial_transactions to recurring_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_transactions_recurring'
  ) THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT fk_financial_transactions_recurring
      FOREIGN KEY (recurring_item_id) REFERENCES recurring_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  3. ROW LEVEL SECURITY                                                     ║
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE budgets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_item_history  ENABLE ROW LEVEL SECURITY;

-- Permissive policies (tighten before production)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'budgets',
    'financial_goals',
    'goal_contributions',
    'recurring_items',
    'recurring_item_history'
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
-- ║  4. REALTIME PUBLICATION                                                   ║
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE financial_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE goal_contributions;
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_items;
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_item_history;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ║  5. SQL VIEWS                                                              ║
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── v_budget_vs_actual ──────────────────────────────────────────────────────
-- Budget amount vs actual spend per category/period with utilization %

CREATE OR REPLACE VIEW v_budget_vs_actual AS
SELECT
  b.id              AS budget_id,
  b.category_id,
  ec.name           AS category_name,
  ec.color          AS category_color,
  b.period_type,
  b.period_start,
  b.amount          AS budget_amount,
  b.rollover_amount,
  (b.amount + b.rollover_amount)                              AS effective_budget,
  b.currency,
  b.context,
  COALESCE(SUM(ft.amount), 0)                                 AS actual_spent,
  (b.amount + b.rollover_amount) - COALESCE(SUM(ft.amount), 0) AS variance,
  CASE
    WHEN (b.amount + b.rollover_amount) > 0
    THEN ROUND((COALESCE(SUM(ft.amount), 0) / (b.amount + b.rollover_amount)) * 100, 2)
    ELSE 0
  END                                                          AS utilization_pct
FROM budgets b
LEFT JOIN expense_categories ec ON ec.id = b.category_id
LEFT JOIN financial_transactions ft
  ON ft.category_id = b.category_id
  AND ft.currency = b.currency
  AND ft.transaction_type = 'expense'
  AND ft.status IN ('completed', 'reconciled')
  AND ft.transaction_date >= b.period_start::timestamptz
  AND ft.transaction_date < (
    CASE b.period_type
      WHEN 'monthly'   THEN b.period_start + INTERVAL '1 month'
      WHEN 'quarterly' THEN b.period_start + INTERVAL '3 months'
      WHEN 'yearly'    THEN b.period_start + INTERVAL '1 year'
    END
  )::timestamptz
GROUP BY b.id, b.category_id, ec.name, ec.color, b.period_type,
         b.period_start, b.amount, b.rollover_amount, b.currency, b.context;

-- ─── v_goal_progress ─────────────────────────────────────────────────────────
-- Goal progress %, daily target, days remaining

CREATE OR REPLACE VIEW v_goal_progress AS
SELECT
  g.id           AS goal_id,
  g.name,
  g.goal_type,
  g.target_amount,
  g.current_amount,
  g.currency,
  g.target_date,
  g.status,
  g.category_id,
  g.context,
  g.color,
  g.icon,
  CASE
    WHEN g.target_amount > 0
    THEN ROUND((g.current_amount / g.target_amount) * 100, 2)
    ELSE 0
  END AS progress_pct,
  CASE
    WHEN g.target_date IS NOT NULL
      AND g.target_date > CURRENT_DATE
      AND g.target_amount > g.current_amount
    THEN ROUND(
      (g.target_amount - g.current_amount) / GREATEST(g.target_date - CURRENT_DATE, 1), 2
    )
    ELSE 0
  END AS daily_target,
  COALESCE(
    (SELECT COUNT(*) FROM goal_contributions gc WHERE gc.goal_id = g.id), 0
  ) AS contribution_count,
  g.target_date - CURRENT_DATE AS days_remaining
FROM financial_goals g
WHERE g.status = 'active';

-- ─── v_recurring_status ──────────────────────────────────────────────────────
-- Recurring items with last actual amount, last status, missed count

CREATE OR REPLACE VIEW v_recurring_status AS
SELECT
  ri.id           AS recurring_item_id,
  ri.name,
  ri.item_type,
  ri.amount       AS expected_amount,
  ri.currency,
  ri.frequency,
  ri.next_due_date,
  ri.company_id,
  ri.contact_id,
  ri.is_active,
  ri.context,
  ri.retainer_hours,
  ri.hourly_rate,
  (
    SELECT rih.actual_amount FROM recurring_item_history rih
    WHERE rih.recurring_item_id = ri.id
    ORDER BY rih.expected_date DESC LIMIT 1
  ) AS last_actual_amount,
  (
    SELECT rih.status FROM recurring_item_history rih
    WHERE rih.recurring_item_id = ri.id
    ORDER BY rih.expected_date DESC LIMIT 1
  ) AS last_status,
  (
    SELECT rih.hours_used FROM recurring_item_history rih
    WHERE rih.recurring_item_id = ri.id AND rih.hours_used IS NOT NULL
    ORDER BY rih.expected_date DESC LIMIT 1
  ) AS last_hours_used,
  (
    SELECT COUNT(*) FROM recurring_item_history rih
    WHERE rih.recurring_item_id = ri.id AND rih.status = 'missed'
  ) AS missed_count
FROM recurring_items ri;

-- ─── v_retainer_summary ──────────────────────────────────────────────────────
-- Retainer utilization: hours, payments, averages

CREATE OR REPLACE VIEW v_retainer_summary AS
SELECT
  ri.id              AS recurring_item_id,
  ri.name,
  ri.amount,
  ri.currency,
  ri.frequency,
  ri.company_id,
  ri.contact_id,
  ri.retainer_hours,
  ri.hourly_rate,
  ri.context,
  COALESCE(SUM(rih.hours_used), 0)          AS total_hours_used,
  COALESCE(SUM(rih.actual_amount), 0)       AS total_received,
  COUNT(CASE WHEN rih.status = 'matched' THEN 1 END) AS periods_paid,
  COUNT(CASE WHEN rih.status = 'missed'  THEN 1 END) AS periods_missed,
  CASE
    WHEN ri.retainer_hours > 0
      AND COUNT(CASE WHEN rih.hours_used IS NOT NULL THEN 1 END) > 0
    THEN ROUND(
      AVG(CASE WHEN rih.hours_used IS NOT NULL
        THEN (rih.hours_used / ri.retainer_hours) * 100
      END), 2
    )
    ELSE NULL
  END AS avg_utilization_pct
FROM recurring_items ri
LEFT JOIN recurring_item_history rih ON rih.recurring_item_id = ri.id
WHERE ri.item_type = 'retainer'
GROUP BY ri.id, ri.name, ri.amount, ri.currency, ri.frequency,
         ri.company_id, ri.contact_id, ri.retainer_hours, ri.hourly_rate, ri.context;
