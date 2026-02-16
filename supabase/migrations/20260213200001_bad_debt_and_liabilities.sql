-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Bad Debt & Liabilities (Debt Tracking)                                     ║
-- ║  Tables: bad_debt_provisions, debts, debt_payments                          ║
-- ║  Views:  v_bad_debt_summary, v_debt_summary, v_debt_schedule               ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ─── 1. Add written_off status to invoices ──────────────────────────────────────

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void', 'refunded', 'written_off'));

-- ─── 2. Bad Debt Provisions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bad_debt_provisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID REFERENCES invoices(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  amount          NUMERIC(15,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  provision_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  write_off_date  DATE,
  status          TEXT NOT NULL DEFAULT 'provisioned'
                    CHECK (status IN ('provisioned', 'written_off', 'recovered', 'partial_recovery')),
  recovery_amount NUMERIC(15,2) DEFAULT 0,
  reason          TEXT,
  notes           TEXT,
  context         TEXT NOT NULL DEFAULT 'business'
                    CHECK (context IN ('business', 'personal')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bad_debt_provisions_status ON bad_debt_provisions(status);
CREATE INDEX IF NOT EXISTS idx_bad_debt_provisions_invoice ON bad_debt_provisions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bad_debt_provisions_context ON bad_debt_provisions(context);

-- ─── 3. Debts / Liabilities ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS debts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  debt_type         TEXT NOT NULL
                      CHECK (debt_type IN (
                        'loan', 'mortgage', 'credit_card', 'vehicle_finance',
                        'overdraft', 'supplier_credit', 'tax_liability',
                        'personal_loan', 'student_loan', 'other'
                      )),
  creditor          TEXT,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  original_amount   NUMERIC(15,2) NOT NULL,
  outstanding_amount NUMERIC(15,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'ZAR',
  interest_rate     NUMERIC(6,3),
  interest_type     TEXT DEFAULT 'fixed'
                      CHECK (interest_type IN ('fixed', 'variable', 'prime_linked', 'none')),
  prime_offset      NUMERIC(6,3),
  monthly_payment   NUMERIC(15,2),
  start_date        DATE NOT NULL,
  end_date          DATE,
  next_payment_date DATE,
  payment_day       INT CHECK (payment_day BETWEEN 1 AND 31),
  account_number    TEXT,
  reference         TEXT,
  bank_account_id   UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'paid_off', 'defaulted', 'restructured', 'written_off', 'paused')),
  priority          TEXT DEFAULT 'normal'
                      CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  context           TEXT NOT NULL DEFAULT 'business'
                      CHECK (context IN ('business', 'personal')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_type ON debts(debt_type);
CREATE INDEX IF NOT EXISTS idx_debts_context ON debts(context);
CREATE INDEX IF NOT EXISTS idx_debts_next_payment ON debts(next_payment_date);

-- ─── 4. Debt Payments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS debt_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id         UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount          NUMERIC(15,2) NOT NULL,
  principal       NUMERIC(15,2),
  interest        NUMERIC(15,2),
  fees            NUMERIC(15,2) DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reference       TEXT,
  transaction_id  UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_date ON debt_payments(payment_date);

-- ─── 5. Bad Debt Summary View ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_bad_debt_summary AS
SELECT
  context,
  currency,
  COALESCE(SUM(CASE WHEN status = 'provisioned' THEN amount ELSE 0 END), 0) AS total_provisioned,
  COALESCE(SUM(CASE WHEN status = 'written_off' THEN amount ELSE 0 END), 0) AS total_written_off,
  COALESCE(SUM(CASE WHEN status IN ('recovered', 'partial_recovery') THEN recovery_amount ELSE 0 END), 0) AS total_recovered,
  COUNT(*) FILTER (WHERE status = 'provisioned') AS provisioned_count,
  COUNT(*) FILTER (WHERE status = 'written_off') AS written_off_count,
  COUNT(*) FILTER (WHERE status IN ('recovered', 'partial_recovery')) AS recovered_count
FROM bad_debt_provisions
GROUP BY context, currency;

-- ─── 6. Debt Summary View ───────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_debt_summary AS
SELECT
  context,
  currency,
  debt_type,
  COUNT(*) AS debt_count,
  COALESCE(SUM(original_amount), 0) AS total_original,
  COALESCE(SUM(outstanding_amount), 0) AS total_outstanding,
  COALESCE(SUM(monthly_payment), 0) AS total_monthly_payments,
  COALESCE(AVG(interest_rate), 0) AS avg_interest_rate,
  MIN(next_payment_date) AS earliest_next_payment
FROM debts
WHERE status = 'active'
GROUP BY context, currency, debt_type;

-- ─── 7. Debt Payment Schedule View ──────────────────────────────────────────────

CREATE OR REPLACE VIEW v_debt_schedule AS
SELECT
  d.id AS debt_id,
  d.name,
  d.debt_type,
  d.creditor,
  d.outstanding_amount,
  d.monthly_payment,
  d.interest_rate,
  d.next_payment_date,
  d.end_date,
  d.context,
  d.currency,
  d.priority,
  CASE
    WHEN d.monthly_payment > 0 AND d.interest_rate = 0
      THEN CEIL(d.outstanding_amount / d.monthly_payment)
    WHEN d.monthly_payment > 0
      THEN CEIL(d.outstanding_amount / (d.monthly_payment * 0.7))
    ELSE NULL
  END AS estimated_months_remaining,
  COALESCE(
    (SELECT SUM(dp.amount) FROM debt_payments dp WHERE dp.debt_id = d.id),
    0
  ) AS total_paid,
  d.original_amount - d.outstanding_amount AS principal_paid
FROM debts d
WHERE d.status = 'active'
ORDER BY d.priority DESC, d.next_payment_date ASC;

-- ─── 8. RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE bad_debt_provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['bad_debt_provisions', 'debts', 'debt_payments']) LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Allow all %1$s" ON %1$I; CREATE POLICY "Allow all %1$s" ON %1$I FOR ALL USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;

-- ─── 9. Realtime ────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE bad_debt_provisions;
ALTER PUBLICATION supabase_realtime ADD TABLE debts;
ALTER PUBLICATION supabase_realtime ADD TABLE debt_payments;
