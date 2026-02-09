-- ============================================================================
-- IN-APP NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'deal_won', 'deal_lost', 'deal_stage_changed', 'new_lead', 'task_due',
    'workflow_completed', 'workflow_failed',
    'invoice_paid', 'invoice_overdue', 'quote_accepted', 'quote_declined',
    'email_received', 'mention', 'system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  link_type TEXT,
  link_id UUID,
  agent_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_is_read ON app_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created ON app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_type ON app_notifications(type);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_notifications' AND policyname = 'Allow all on app_notifications') THEN CREATE POLICY "Allow all on app_notifications" ON app_notifications FOR ALL USING (true); END IF; END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
