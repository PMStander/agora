-- ============================================================================
-- Extend notification types for agent growth features
-- ============================================================================

ALTER TABLE app_notifications DROP CONSTRAINT IF EXISTS app_notifications_type_check;
ALTER TABLE app_notifications ADD CONSTRAINT app_notifications_type_check CHECK (type IN (
  'deal_won', 'deal_lost', 'deal_stage_changed', 'new_lead', 'task_due',
  'workflow_completed', 'workflow_failed',
  'invoice_paid', 'invoice_overdue', 'quote_accepted', 'quote_declined',
  'email_received', 'mention', 'system',
  'agent_reflection', 'reflection_pattern'
));
