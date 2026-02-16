// ─── Boardroom Types ──────────────────────────────────────────────────────

import type { MediaAttachment } from './supabase';

export type BoardroomSessionType =
  | 'standup'
  | 'task_review'
  | 'strategy'
  | 'brainstorm'
  | 'watercooler'
  | 'debate'
  | 'war_room'
  | 'custom'
  | 'chat';

export type BoardroomSessionStatus = 'proposed' | 'scheduled' | 'preparing' | 'open' | 'active' | 'closed' | 'declined';

export interface BoardroomSession {
  id: string;
  title: string;
  topic: string;
  session_type: BoardroomSessionType;
  status: BoardroomSessionStatus;
  participant_agent_ids: string[];
  current_turn_agent_id: string | null;
  turn_count: number;
  max_turns: number;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string; // 'user' or an agent ID
  metadata: BoardroomSessionMetadata;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Entity References ───────────────────────────────────────────────────

export type EntityReferenceType = 'company' | 'contact' | 'product' | 'project' | 'deal';

export interface EntityReference {
  type: EntityReferenceType;
  id: string;
  label: string;
  emoji?: string;
}

export const ENTITY_TYPE_EMOJI: Record<EntityReferenceType, string> = {
  company: '🏢',
  contact: '👤',
  product: '📦',
  project: '📁',
  deal: '💰',
};

// ─── Preparation Phase ───────────────────────────────────────────────────

export type PrepMode = 'research' | 'mission';
export type PrepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface PrepAssignment {
  agent_id: string;
  mode: PrepMode;
  prompt: string;
  delegate_to?: string[];
}

export interface PrepResult {
  agent_id: string;
  status: PrepStatus;
  text: string;
  mission_id?: string;
  error?: string;
  completed_at?: string;
}

// ─── Prep Documents ──────────────────────────────────────────────────────

export interface PrepDocument {
  agent_id: string;
  title: string;
  path: string;
  status: 'pending' | 'done' | 'failed';
}

// ─── Routing & Session Control ─────────────────────────────────────────────

export type RoutingMode = 'smart' | 'round-robin';

export type SessionPhase = 'opening' | 'discussion' | 'wrap-up';

export interface TurnTracking {
  agent_id: string;
  turn_count: number;
  last_mentioned_turn?: number;
  last_spoke_turn?: number;
}

export interface SessionSummary {
  decisions: string[];
  action_items: Array<{ task: string; owner?: string }>;
  unresolved: string[];
  generated_at: string;
}

export interface DisagreementTracking {
  turn: number;
  agents: string[];
  topic: string;
  resolved: boolean;
}

// ─── Resolution Package ─────────────────────────────────────────────────────

export type ResolutionMode = 'auto' | 'propose' | 'none';

export type ResolutionItemStatus = 'pending' | 'approved' | 'rejected' | 'created';

export interface ResolutionMission {
  title: string;
  description: string;
  agent_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies?: string[];
  scheduled_at?: string;
  source_excerpt: string;
}

export interface ResolutionProject {
  name: string;
  description: string;
  mission_ids: string[];
  source_excerpt: string;
}

export interface ResolutionDocument {
  title: string;
  description: string;
  agent_id: string;
  type: 'brief' | 'spec' | 'proposal' | 'report';
  source_excerpt: string;
}

export interface ResolutionCRMAction {
  type: 'company' | 'contact' | 'deal';
  action: 'create' | 'update';
  name: string;
  details: Record<string, any>;
  source_excerpt: string;
}

export interface ResolutionFollowUpMeeting {
  title: string;
  topic: string;
  participant_agent_ids: string[];
  agenda: string[];
  scheduled_at?: string;
  unresolved_items: string[];
  source_excerpt: string;
}

export interface ResolutionCalendarEvent {
  title: string;
  description: string;
  start_time: string;
  duration_minutes: number;
  attendees: string[];
  source_excerpt: string;
}

export interface ResolutionQuote {
  customer: string;
  description: string;
  items: Array<{ description: string; amount?: number }>;
  source_excerpt: string;
}

export interface ResolutionPackageItem {
  id: string;
  type: 'mission' | 'project' | 'document' | 'crm' | 'follow_up' | 'event' | 'quote';
  status: ResolutionItemStatus;
  data: ResolutionMission | ResolutionProject | ResolutionDocument | ResolutionCRMAction | ResolutionFollowUpMeeting | ResolutionCalendarEvent | ResolutionQuote;
  created_id?: string; // ID of the created object (mission_id, session_id, etc.)
  error?: string;
}

export interface ResolutionPackage {
  session_id: string;
  generated_at: string;
  items: ResolutionPackageItem[];
  mode: ResolutionMode;
  approved_at?: string;
  approved_by?: string;
}

// ─── Session Metadata ────────────────────────────────────────────────────

export interface BoardroomSessionMetadata {
  entity_references?: EntityReference[];
  attachments?: MediaAttachment[];
  agenda?: string[];
  context?: string;
  prep_documents?: PrepDocument[];
  preparation?: {
    assignments: PrepAssignment[];
    results: PrepResult[];
    status: PrepStatus;
    started_at?: string;
    completed_at?: string;
  };
  routing_mode?: RoutingMode;
  auto_start?: boolean;
  notify_whatsapp?: boolean;
  turn_tracking?: TurnTracking[];
  session_summary?: SessionSummary;
  current_phase?: SessionPhase;
  extension_count?: number;
  disagreements?: DisagreementTracking[];
  resolution_mode?: ResolutionMode;
  resolution_package?: ResolutionPackage;
  user_participation?: UserParticipation;
  last_routing_decision?: {
    turn: number;
    chosen_agent: string;
    reasoning: string;
    timestamp: string;
  };
  cloned_from_session_id?: string;
  // Agent proposal fields
  proposal_reason?: string;
  proposal_urgency?: 'low' | 'medium' | 'high' | 'critical';
  proposed_by_context?: string; // what the agent was doing when it proposed
  // Follow-up depth tracking (prevents infinite recursion)
  follow_up_depth?: number;
  source_session_id?: string;
  [key: string]: unknown; // allow additional ad-hoc fields
}

// ─── User Participation ──────────────────────────────────────────────────

export interface UserParticipation {
  enabled: boolean;
  user_turn_timeout_ms?: number; // How long to wait for user input (default 5 min)
  user_raised_hand?: boolean; // User signaled they want to speak
  waiting_for_user?: boolean; // Orchestrator is paused waiting for user
  decision_points?: Array<{
    turn: number;
    question: string;
    resolved: boolean;
  }>;
}

export type MessageSenderType = 'user' | 'agent' | 'system';

export interface MessageMention {
  type: 'agent' | 'entity';
  id: string;
  display: string;
  entity_type?: EntityReferenceType;
}

export interface BoardroomMessage {
  id: string;
  session_id: string;
  agent_id: string;
  content: string;
  reasoning: string | null;
  turn_number: number;
  sender_type: MessageSenderType;
  mentions: MessageMention[];
  created_at: string;
}

// ─── Session Type Presets ─────────────────────────────────────────────────

export interface SessionTypePreset {
  type: BoardroomSessionType;
  label: string;
  icon: string;
  description: string;
  defaultMaxTurns: number;
  guidance: string;
}

export const SESSION_TYPE_PRESETS: SessionTypePreset[] = [
  {
    type: 'standup',
    label: 'Morning Standup',
    icon: '🌅',
    description: 'Quick sync on priorities and blockers',
    defaultMaxTurns: 12,
    guidance: 'Keep responses brief (2-3 sentences). Share: what you completed, what you plan to do, and any blockers. Be specific and actionable.',
  },
  {
    type: 'task_review',
    label: 'Task Review',
    icon: '📋',
    description: 'Evaluate completed work and provide feedback',
    defaultMaxTurns: 10,
    guidance: 'Review the work discussed. Provide constructive feedback. Highlight strengths and suggest improvements. Be specific about what went well and what could be better.',
  },
  {
    type: 'strategy',
    label: 'Strategy Session',
    icon: '♟️',
    description: 'Long-term planning and direction',
    defaultMaxTurns: 15,
    guidance: 'Think long-term. Consider market dynamics, competitive landscape, and resource constraints. Propose concrete strategic initiatives with clear rationale.',
  },
  {
    type: 'brainstorm',
    label: 'Brainstorm',
    icon: '💡',
    description: 'Generate creative ideas, no criticism',
    defaultMaxTurns: 10,
    guidance: 'Generate ideas freely. Build on what others suggest. No criticism or judgment in this phase. The wilder the idea, the better. Quantity over quality.',
  },
  {
    type: 'watercooler',
    label: 'Watercooler',
    icon: '☕',
    description: 'Casual chat, surprising insights',
    defaultMaxTurns: 5,
    guidance: 'Be casual and conversational. Share observations, interesting connections, or random thoughts. No agenda needed — just talk.',
  },
  {
    type: 'debate',
    label: 'Debate',
    icon: '⚔️',
    description: 'Opposing views, evidence-based argument',
    defaultMaxTurns: 10,
    guidance: 'Take a clear position and defend it with evidence. Challenge other viewpoints respectfully but firmly. Acknowledge good counter-arguments. Seek truth through dialectic.',
  },
  {
    type: 'war_room',
    label: 'War Room',
    icon: '🚨',
    description: 'Crisis response, decisive action',
    defaultMaxTurns: 8,
    guidance: 'Focus on the crisis at hand. Propose concrete, immediate actions. Assign responsibilities. No theoretical discussions — solutions only. Urgency matters.',
  },
  {
    type: 'custom',
    label: 'Custom',
    icon: '⚙️',
    description: 'Define your own session format',
    defaultMaxTurns: 10,
    guidance: 'Respond thoughtfully to the session topic. Follow any specific instructions provided. Engage constructively with other participants.',
  },
  {
    type: 'chat',
    label: 'Project Chat',
    icon: '💬',
    description: 'Open-ended team conversation',
    defaultMaxTurns: 999,
    guidance: 'You are in a project team chat. Respond naturally and helpfully to the user. Build on what other team members have said. Be concise but thorough. If the question is outside your expertise, say so and suggest which team member might be better suited.',
  },
];

export function getSessionPreset(type: BoardroomSessionType): SessionTypePreset {
  return SESSION_TYPE_PRESETS.find((p) => p.type === type) || SESSION_TYPE_PRESETS[SESSION_TYPE_PRESETS.length - 1];
}
