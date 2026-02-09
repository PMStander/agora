-- ============================================================================
-- PAYMENT SETTINGS & PAYMENT LINKS (PayPal Integration)
-- ============================================================================

-- Payment provider settings (client_id, mode, currency -- NOT secrets)
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('paypal', 'manual', 'bank_transfer')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider)
);

-- Payment links (PayPal orders tied to invoices)
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paypal',
  external_id TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'approved', 'completed', 'cancelled', 'expired')),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payer_email TEXT,
  payer_name TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_links_invoice ON payment_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status);
CREATE INDEX IF NOT EXISTS idx_payment_links_external ON payment_links(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_settings_provider ON payment_settings(provider);

-- RLS
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_settings' AND policyname = 'Allow all on payment_settings') THEN CREATE POLICY "Allow all on payment_settings" ON payment_settings FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_links' AND policyname = 'Allow all on payment_links') THEN CREATE POLICY "Allow all on payment_links" ON payment_links FOR ALL USING (true); END IF; END $$;

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payment_links; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
