// ─── Workflow Types ──────────────────────────────────────────────────────────

export type TriggerType =
  | 'entity_created'
  | 'entity_updated'
  | 'field_changed'
  | 'stage_changed'
  | 'deal_won'
  | 'deal_lost'
  | 'schedule'
  | 'manual'
  | 'webhook';

export type TriggerEntity =
  | 'contact'
  | 'company'
  | 'deal'
  | 'order'
  | 'invoice'
  | 'quote'
  | 'project';

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting';

export type ActionStepType =
  | 'create_mission'
  | 'update_field'
  | 'send_notification'
  | 'create_interaction'
  | 'wait'
  | 'create_task';

// ─── Action Step ─────────────────────────────────────────────────────────────

export interface ActionStep {
  type: ActionStepType;
  // create_mission
  agent_id?: string;
  template?: string;
  mission_title?: string;
  // update_field
  entity?: TriggerEntity;
  field?: string;
  value?: string;
  // send_notification
  message?: string;
  // create_interaction
  interaction_type?: string;
  body?: string;
  subject?: string;
  // wait
  duration?: string; // e.g. "3d", "1h", "30m"
  // create_task
  title?: string;
  description?: string;
  priority?: string;
}

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  trigger_type: TriggerType;
  trigger_entity: TriggerEntity | null;
  trigger_conditions: Record<string, unknown>;
  trigger_schedule: string | null;
  actions: ActionStep[];
  owner_agent_id: string | null;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  trigger_payload: Record<string, unknown>;
  current_step: number;
  steps_completed: number;
  steps_total: number;
  error_message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  mission_id: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowSequence {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  steps: Array<{ day: number; action: string; template?: string }>;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Config Objects ──────────────────────────────────────────────────────────

export const TRIGGER_TYPE_CONFIG: Record<TriggerType, { label: string; description: string }> = {
  entity_created: { label: 'Entity Created', description: 'Fires when a new record is created' },
  entity_updated: { label: 'Entity Updated', description: 'Fires when any field on a record changes' },
  field_changed: { label: 'Field Changed', description: 'Fires when a specific field changes value' },
  stage_changed: { label: 'Stage Changed', description: 'Fires when a deal moves to a different stage' },
  deal_won: { label: 'Deal Won', description: 'Fires when a deal is marked as won' },
  deal_lost: { label: 'Deal Lost', description: 'Fires when a deal is marked as lost' },
  schedule: { label: 'Schedule', description: 'Fires on a cron schedule' },
  manual: { label: 'Manual', description: 'Fires only when triggered manually' },
  webhook: { label: 'Webhook', description: 'Fires when an external webhook is received' },
};

export const ACTION_TYPE_CONFIG: Record<ActionStepType, { label: string; description: string }> = {
  create_mission: { label: 'Create Mission', description: 'Create a new mission for an agent' },
  update_field: { label: 'Update Field', description: 'Update a field on the triggering entity' },
  send_notification: { label: 'Send Notification', description: 'Send a notification message' },
  create_interaction: { label: 'Log Interaction', description: 'Create a CRM interaction record' },
  wait: { label: 'Wait', description: 'Pause execution for a duration' },
  create_task: { label: 'Create Task', description: 'Create a new task for an agent' },
};

export const TRIGGER_ENTITY_OPTIONS: { value: TriggerEntity; label: string }[] = [
  { value: 'contact', label: 'Contact' },
  { value: 'company', label: 'Company' },
  { value: 'deal', label: 'Deal' },
  { value: 'order', label: 'Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote' },
  { value: 'project', label: 'Project' },
];

export const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'zinc' },
  active: { label: 'Active', color: 'green' },
  paused: { label: 'Paused', color: 'amber' },
  archived: { label: 'Archived', color: 'red' },
};

export const WORKFLOW_RUN_STATUS_CONFIG: Record<WorkflowRunStatus, { label: string; color: string }> = {
  running: { label: 'Running', color: 'blue' },
  completed: { label: 'Completed', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'zinc' },
  waiting: { label: 'Waiting', color: 'amber' },
};
