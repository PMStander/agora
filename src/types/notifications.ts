// ─── Notification Types ─────────────────────────────────────────────────────

export type NotificationType =
  | 'deal_won'
  | 'deal_lost'
  | 'deal_stage_changed'
  | 'new_lead'
  | 'task_due'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'quote_accepted'
  | 'quote_declined'
  | 'email_received'
  | 'mention'
  | 'system'
  | 'agent_reflection'
  | 'reflection_pattern'
  | 'agent_session_proposed'
  | 'agent_mission_created'
  | 'agent_action_proposed'
  | 'resolution_ready';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type NotificationLinkType =
  | 'contact'
  | 'company'
  | 'deal'
  | 'invoice'
  | 'quote'
  | 'workflow_run'
  | 'mission'
  | 'project'
  | 'agent'
  | 'session';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  severity: NotificationSeverity;
  is_read: boolean;
  read_at: string | null;
  link_type: NotificationLinkType | null;
  link_id: string | null;
  agent_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  { label: string; icon: string; defaultSeverity: NotificationSeverity }
> = {
  deal_won: { label: 'Deal Won', icon: '🎉', defaultSeverity: 'success' },
  deal_lost: { label: 'Deal Lost', icon: '😞', defaultSeverity: 'warning' },
  deal_stage_changed: { label: 'Deal Moved', icon: '➡️', defaultSeverity: 'info' },
  new_lead: { label: 'New Lead', icon: '🆕', defaultSeverity: 'info' },
  task_due: { label: 'Task Due', icon: '⏰', defaultSeverity: 'warning' },
  workflow_completed: { label: 'Workflow Done', icon: '✅', defaultSeverity: 'success' },
  workflow_failed: { label: 'Workflow Failed', icon: '❌', defaultSeverity: 'error' },
  invoice_paid: { label: 'Invoice Paid', icon: '💰', defaultSeverity: 'success' },
  invoice_overdue: { label: 'Invoice Overdue', icon: '🚨', defaultSeverity: 'error' },
  quote_accepted: { label: 'Quote Accepted', icon: '👍', defaultSeverity: 'success' },
  quote_declined: { label: 'Quote Declined', icon: '👎', defaultSeverity: 'warning' },
  email_received: { label: 'Email Received', icon: '📧', defaultSeverity: 'info' },
  mention: { label: 'Mention', icon: '@', defaultSeverity: 'info' },
  system: { label: 'System', icon: '🔔', defaultSeverity: 'info' },
  agent_reflection: { label: 'Agent Reflection', icon: '🪞', defaultSeverity: 'info' },
  reflection_pattern: { label: 'Reflection Pattern', icon: '⚠️', defaultSeverity: 'warning' },
  agent_session_proposed: { label: 'Meeting Proposed', icon: '🤝', defaultSeverity: 'warning' },
  agent_mission_created: { label: 'Mission Created', icon: '🎯', defaultSeverity: 'info' },
  agent_action_proposed: { label: 'Action Proposed', icon: '📋', defaultSeverity: 'warning' },
  resolution_ready: { label: 'Resolution Ready', icon: '📦', defaultSeverity: 'warning' },
};

export const SEVERITY_CONFIG: Record<
  NotificationSeverity,
  { label: string; color: string; bgClass: string; borderClass: string }
> = {
  info: { label: 'Info', color: 'blue', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/20' },
  success: { label: 'Success', color: 'green', bgClass: 'bg-green-500/10', borderClass: 'border-green-500/20' },
  warning: { label: 'Warning', color: 'amber', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20' },
  error: { label: 'Error', color: 'red', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/20' },
};
