// ─── Mission Control V2 Types ───────────────────────────────────────────────

export type MissionStatus = 'scheduled' | 'assigned' | 'in_progress' | 'pending_review' | 'revision' | 'done' | 'failed';
export type MissionPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MissionPhase = 'statement' | 'plan' | 'tasks';
export type MissionPhaseStatus = 'draft' | 'awaiting_approval' | 'approved';
export type TeamType = 'orchestrator' | 'personal' | 'business' | 'engineering';

export interface Mission {
  id: string;
  title: string;
  description: string | null;
  status: MissionStatus;
  mission_status: MissionStatus;
  mission_phase: MissionPhase;
  mission_phase_status: MissionPhaseStatus;
  mission_statement: string | null;
  mission_plan: string | null;
  priority: MissionPriority;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  agent_id: string;
  input_text: string | null;
  input_media: Array<{ url: string; type: string; name: string }>;
  review_enabled: boolean;
  review_agent_id: string | null;
  output_text: string | null;
  output_media: Array<{ url: string; type: string; name: string }>;
  parent_mission_id: string | null;
  revision_round: number;
  max_revisions: number;
  review_notes: string | null;
  feedback_text: string | null;
  reopened_at: string | null;
  created_by: string;
  session_key: string | null;
  domains: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface MissionLog {
  id: string;
  mission_id: string;
  type: string;
  agent_id: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Database schema for Supabase client
export interface Database {
  public: {
    Tables: {
      missions: {
        Row: Mission;
        Insert: Partial<Mission>;
        Update: Partial<Mission>;
      };
      mission_logs: {
        Row: MissionLog;
        Insert: Partial<MissionLog>;
        Update: Partial<MissionLog>;
      };
      task_dependencies: {
        Row: TaskDependency;
        Insert: Partial<TaskDependency>;
        Update: Partial<TaskDependency>;
      };
    };
  };
}

// ─── Agent Definitions ──────────────────────────────────────────────────────

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  emoji: string;
  team: TeamType;
}

export const AGENTS: AgentDef[] = [
  { id: 'main', name: 'Marcus Aurelius', role: 'Main Orchestrator', emoji: '🏛️', team: 'orchestrator' },
  { id: 'hippocrates', name: 'Hippocrates', role: 'Fitness & Health', emoji: '💪', team: 'personal' },
  { id: 'confucius', name: 'Confucius', role: 'Family & Relationships', emoji: '🏡', team: 'personal' },
  { id: 'seneca', name: 'Seneca', role: 'Personal Finance', emoji: '💰', team: 'personal' },
  { id: 'archimedes', name: 'Archimedes', role: 'Tech Enthusiast', emoji: '⚙️', team: 'personal' },
  { id: 'leonidas', name: 'Leonidas', role: 'CEO', emoji: '⚔️', team: 'business' },
  { id: 'odysseus', name: 'Odysseus', role: 'CFO', emoji: '🧭', team: 'business' },
  { id: 'spartacus', name: 'Spartacus', role: 'HR', emoji: '✊', team: 'business' },
  { id: 'achilles', name: 'Achilles', role: 'CTO', emoji: '🔥', team: 'business' },
  { id: 'alexander', name: 'Alexander', role: 'Marketing', emoji: '🦁', team: 'business' },
  // Dev Team (under Achilles / CTO)
  { id: 'heracles', name: 'Heracles', role: 'Senior Fullstack Dev', emoji: '💪', team: 'business' },
  { id: 'daedalus', name: 'Daedalus', role: 'Backend Engineer', emoji: '🏗️', team: 'business' },
  { id: 'icarus', name: 'Icarus', role: 'Frontend Engineer', emoji: '🪽', team: 'business' },
  { id: 'ajax', name: 'Ajax', role: 'DevOps & Infrastructure', emoji: '🛡️', team: 'business' },
  // Marketing Team (under Alexander / Marketing Head)
  { id: 'cleopatra', name: 'Cleopatra', role: 'Content Strategist', emoji: '👑', team: 'business' },
  { id: 'homer', name: 'Homer', role: 'Copywriter & Brand Voice', emoji: '📜', team: 'business' },
  { id: 'hermes', name: 'Hermes', role: 'Social & Distribution', emoji: '🪶', team: 'business' },
  { id: 'athena', name: 'Athena', role: 'Security Architect', emoji: '🦉', team: 'engineering' },
  { id: 'hephaestus', name: 'Hephaestus', role: 'Lead Developer', emoji: '🔨', team: 'engineering' },
  { id: 'prometheus', name: 'Prometheus', role: 'Innovation Lead', emoji: '💡', team: 'engineering' },
];

export function getAgent(agentId: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === agentId);
}

export function getAgentsByTeam(team: TeamType): AgentDef[] {
  return AGENTS.filter((a) => a.team === team);
}

// ─── Kanban Column Definitions ──────────────────────────────────────────────

export interface KanbanColumnDef {
  id: MissionStatus;
  title: string;
  color: string;
}

export const MISSION_COLUMNS: KanbanColumnDef[] = [
  { id: 'scheduled', title: '📅 Queued', color: 'zinc' },
  { id: 'assigned', title: '🧩 Ready', color: 'blue' },
  { id: 'in_progress', title: '🔄 In Progress', color: 'amber' },
  { id: 'pending_review', title: '👁️ Review', color: 'purple' },
  { id: 'revision', title: '♻️ Rework', color: 'orange' },
  { id: 'done', title: '✅ Done', color: 'green' },
  { id: 'failed', title: '❌ Failed', color: 'red' },
];

// ─── Task System (Simplified Mission Interface) ────────────────────────────

export type TaskStatus = 'todo' | 'blocked' | 'in_progress' | 'review' | 'done' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReviewAction = 'approve' | 'revise' | 'redo';

export interface MediaAttachment {
  url: string;
  type: string;
  name: string;
}

export interface ReviewHistoryEntry {
  round: number;
  action: ReviewAction;
  summary: string;
  confidence_score: number;
  specific_issues: string[];
  new_instructions: string | null;
  reviewer_agent_id: string;
  reviewed_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  domains: string[];
  assignees: Array<{ id: string; name: string; emoji: string }>;
  due_at: string;
  started_at: string | null;
  completed_at: string | null;
  primary_agent_id: string;
  review_enabled: boolean;
  review_agent_id: string | null;
  max_revisions: number;
  revision_round: number;
  parent_task_id: string | null;
  root_task_id: string | null;
  input_text: string | null;
  input_media: MediaAttachment[];
  output_text: string | null;
  review_notes: string | null;
  review_history: ReviewHistoryEntry[];
  dependency_task_ids: string[];
  linked_revision_task_id: string | null;
  active_run_id: string | null;
  active_phase: 'primary' | 'review' | null;
  active_thinking: string | null;
  active_summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanTaskColumnDef {
  id: TaskStatus;
  title: string;
  color: string;
}

export const TASK_COLUMNS: KanbanTaskColumnDef[] = [
  { id: 'todo', title: '📋 To Do', color: 'zinc' },
  { id: 'blocked', title: '⛔ Blocked', color: 'rose' },
  { id: 'in_progress', title: '🔄 In Progress', color: 'amber' },
  { id: 'review', title: '👁️ Review', color: 'purple' },
  { id: 'done', title: '✅ Done', color: 'green' },
  { id: 'failed', title: '❌ Failed', color: 'red' },
];

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

// ─── Activity Feed ──────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  type: string;
  message: string;
  agent: { id: string; name: string; emoji: string } | null;
  created_at: string;
}

// ─── Connection Fail-safes ───────────────────────────────────────────────────

export type ConnectionQuality = 'good' | 'degraded' | 'lost';

export interface RunCheckpoint {
  taskId: string;
  phase: 'primary' | 'review';
  agentId: string;
  prompt: string;
  buffer: string;
  timestamp: number;
  connectionDrops: number;
}

// ─── Comment System ─────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  task_id: string;
  author: { id: string; name: string; emoji: string };
  content: string;
  created_at: string;
}

// ─── Domain Definitions ─────────────────────────────────────────────────────

export const ALL_DOMAINS = [
  'fitness',
  'health',
  'nutrition',
  'family',
  'relationships',
  'personal-finance',
  'budgeting',
  'investing',
  'technology',
  'gadgets',
  'coding',
  'business-strategy',
  'leadership',
  'finance',
  'hr',
  'recruitment',
  'tech-infrastructure',
  'development',
  'marketing',
  'sales',
] as const;

export type Domain = typeof ALL_DOMAINS[number];

// ─── Re-exports from specialized type files ─────────────────────────────────

export type {
  ReviewTrigger,
  ReviewStatus,
  LevelRecommendation,
  ReviewCadence,
  StarRating,
  TaskCompletionMetrics,
  QualityMetrics,
  SpeedMetrics,
  CollaborationMetrics,
  DomainPerformance,
  GuardrailMetrics,
  ReviewMetrics,
  ReviewRatings,
  PerformanceReview,
  LevelChangeReason,
  LevelChangeRecord,
  AgentFeedbackEntry,
  ReviewSchedule,
} from './reviews';

export type {
  AccessLevel,
  MemoryTier,
  HandoffStatus,
  ContextDocType,
  ProjectContext,
  ContextAccessEntry,
  ContextDocument,
  ContextRevision,
  AgentRegistryEntry,
  HandoffRequest,
  DailyNote,
  DailyNoteEntry,
  LongTermMemory,
  CrossProjectInsight,
} from './context';

// ─── SOUL Profile System (from Agent Hiring design) ─────────────────────────

export interface SoulInspiration {
  name: string;
  relationship: string;
}

export interface SoulProfile {
  origin: string;
  philosophy: string[];
  inspirations: SoulInspiration[];
  communicationStyle: {
    tone: string;
    formality: 'casual' | 'balanced' | 'formal';
    verbosity: 'concise' | 'balanced' | 'thorough';
    quirks: string[];
  };
  neverDos: string[];
  preferredWorkflows: string[];
  additionalNotes: string | null;
}

// ─── Agent Lifecycle & Hiring ───────────────────────────────────────────────

export type AgentLifecycleStatus =
  | 'candidate'
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'retired';

export type OnboardingStep =
  | 'soul_review'
  | 'avatar_set'
  | 'team_assigned'
  | 'intro_message_sent'
  | 'first_task_assigned'
  | 'workflow_configured';

export interface OnboardingChecklistItem {
  step: OnboardingStep;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

export interface DomainExpertise {
  domain: string;
  depth: 'novice' | 'intermediate' | 'expert' | 'master';
}

export interface HiringRoleSpec {
  roleTitle: string;
  team: TeamType;
  domains: string[];
  specialization: string;
  archetype: string | null;
}

/**
 * Extended agent interface with SOUL profile, lifecycle, and hiring metadata.
 * Extends the base Agent interface from the agents store.
 */
export interface AgentFull {
  id: string;
  name: string;
  role: string;
  emoji: string;
  team: TeamType;
  avatar: string;
  persona: string;

  soul: SoulProfile;
  lifecycleStatus: AgentLifecycleStatus;
  domains: DomainExpertise[];
  skills: string[];
  provider: string;
  model: string;
  hiredAt: string | null;
  onboardedAt: string | null;
  retiredAt: string | null;
  onboardingChecklist: OnboardingChecklistItem[];
  createdBy: 'user' | 'system' | 'ai_suggested';
  soulVersion: number;
}

// ─── Agent Leveling Framework ───────────────────────────────────────────────

export type AgentLevel = 1 | 2 | 3 | 4;
export type AgentLevelName = 'observer' | 'advisor' | 'operator' | 'autonomous';

export const AGENT_LEVEL_NAMES: Record<AgentLevel, AgentLevelName> = {
  1: 'observer',
  2: 'advisor',
  3: 'operator',
  4: 'autonomous',
};

export const AGENT_LEVEL_LABELS: Record<AgentLevel, string> = {
  1: 'Observer',
  2: 'Advisor',
  3: 'Operator',
  4: 'Autonomous',
};

export const AGENT_LEVEL_COLORS: Record<AgentLevel, string> = {
  1: 'zinc',
  2: 'blue',
  3: 'amber',
  4: 'emerald',
};

// ─── Permission Types ───────────────────────────────────────────────────────

export type PermissionAction =
  | 'mission:create'
  | 'mission:execute'
  | 'mission:approve_statement'
  | 'mission:approve_plan'
  | 'mission:assign'
  | 'task:execute'
  | 'task:create_subtask'
  | 'task:complete'
  | 'task:reassign'
  | 'comms:send_message'
  | 'comms:delegate'
  | 'comms:broadcast'
  | 'context:read'
  | 'context:write'
  | 'context:delete'
  | 'autonomous:act'
  | 'autonomous:self_schedule'
  | 'autonomous:override_lower';

export type PermissionResult = 'allow' | 'deny' | 'approval_required' | 'draft';

export interface PermissionCheck {
  action: PermissionAction;
  result: PermissionResult;
  reason?: string;
  approval_gate?: 'human_required' | 'guardrail_check' | 'self_approved';
}

// ─── Guardrails ─────────────────────────────────────────────────────────────

export type GuardrailViolationSeverity = 'info' | 'warning' | 'critical';
export type GuardrailResolution = 'auto_denied' | 'escalated' | 'human_overridden' | 'approved';

export interface AgentGuardrails {
  allowed_domains: string[];
  allowed_actions: PermissionAction[];
  denied_actions: PermissionAction[];
  max_concurrent_missions: number;
  max_daily_tasks: number;
  escalation_agent_id: string | null;
  auto_review_threshold: number;
}

export interface GuardrailViolation {
  id: string;
  agent_id: string;
  action_attempted: PermissionAction;
  guardrail_violated: string;
  severity: GuardrailViolationSeverity;
  resolution: GuardrailResolution;
  context: Record<string, unknown>;
  created_at: string;
}

// ─── Level Transitions ──────────────────────────────────────────────────────

export type LevelTransitionTrigger = 'promotion' | 'demotion' | 'manual_override';

export interface LevelMetricsSnapshot {
  tasks_completed: number;
  avg_review_score: number;
  violations_30d: number;
  critical_violations_7d: number;
  consecutive_failures: number;
  time_in_level_days: number;
}

export interface LevelTransitionRequest {
  id: string;
  agent_id: string;
  from_level: AgentLevel;
  to_level: AgentLevel;
  trigger: LevelTransitionTrigger;
  reason: string;
  metrics_snapshot: LevelMetricsSnapshot;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  cooldown_until: string | null;
  created_at: string;
}

export interface LevelHistoryEntry {
  id: string;
  agent_id: string;
  from_level: AgentLevel;
  to_level: AgentLevel;
  trigger: LevelTransitionTrigger;
  reason: string;
  approved_by: 'system' | 'human';
  metrics_snapshot: LevelMetricsSnapshot;
  created_at: string;
}

// ─── Agent Level State ──────────────────────────────────────────────────────

export interface AgentLevelState {
  agent_id: string;
  current_level: AgentLevel;
  guardrails: AgentGuardrails;
  level_history: LevelHistoryEntry[];
  metrics: LevelMetricsSnapshot;
  pending_transition: LevelTransitionRequest | null;
  level_assigned_at: string;
  created_at: string;
  updated_at: string;
}

// ─── Promotion Thresholds ───────────────────────────────────────────────────

export interface LevelUpCriteria {
  min_tasks_completed: number;
  min_avg_review_score: number;
  min_time_in_level_days: number;
  max_critical_violations_30d: number;
  max_warning_violations_30d: number;
  requires_human_approval: boolean;
}

export const DEFAULT_LEVEL_UP_CRITERIA: Record<AgentLevel, LevelUpCriteria | null> = {
  1: {
    min_tasks_completed: 10,
    min_avg_review_score: 0.7,
    min_time_in_level_days: 7,
    max_critical_violations_30d: 0,
    max_warning_violations_30d: 5,
    requires_human_approval: true,
  },
  2: {
    min_tasks_completed: 25,
    min_avg_review_score: 0.8,
    min_time_in_level_days: 14,
    max_critical_violations_30d: 0,
    max_warning_violations_30d: 2,
    requires_human_approval: true,
  },
  3: {
    min_tasks_completed: 50,
    min_avg_review_score: 0.9,
    min_time_in_level_days: 30,
    max_critical_violations_30d: 0,
    max_warning_violations_30d: 0,
    requires_human_approval: true,
  },
  4: null,
};
