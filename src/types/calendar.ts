// ─── Calendar Types ─────────────────────────────────────────────────────────

export type CalendarEventType =
  | 'meeting'
  | 'call'
  | 'task_due'
  | 'follow_up'
  | 'deadline'
  | 'reminder'
  | 'other';

export type CalendarEventStatus =
  | 'scheduled'
  | 'confirmed'
  | 'tentative'
  | 'cancelled'
  | 'completed';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

// ─── Entity ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  status: CalendarEventStatus;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  timezone: string;
  recurrence_rule: string | null;
  location: string | null;
  meeting_url: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  interaction_id: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  owner_agent_id: string | null;
  attendee_agent_ids: string[];
  reminder_minutes: number[];
  color: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Config Objects ─────────────────────────────────────────────────────────

export const EVENT_TYPE_CONFIG: Record<CalendarEventType, { label: string; color: string; icon: string }> = {
  meeting: { label: 'Meeting', color: 'blue', icon: 'M' },
  call: { label: 'Call', color: 'green', icon: 'C' },
  task_due: { label: 'Task Due', color: 'amber', icon: 'T' },
  follow_up: { label: 'Follow-up', color: 'purple', icon: 'F' },
  deadline: { label: 'Deadline', color: 'red', icon: 'D' },
  reminder: { label: 'Reminder', color: 'cyan', icon: 'R' },
  other: { label: 'Other', color: 'zinc', icon: 'O' },
};

export const EVENT_STATUS_CONFIG: Record<CalendarEventStatus, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'blue' },
  confirmed: { label: 'Confirmed', color: 'green' },
  tentative: { label: 'Tentative', color: 'amber' },
  cancelled: { label: 'Cancelled', color: 'zinc' },
  completed: { label: 'Completed', color: 'green' },
};

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'FREQ=DAILY', label: 'Daily' },
  { value: 'FREQ=WEEKLY', label: 'Weekly' },
  { value: 'FREQ=MONTHLY', label: 'Monthly' },
] as const;
