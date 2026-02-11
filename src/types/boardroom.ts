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
  | 'custom';

export type BoardroomSessionStatus = 'scheduled' | 'preparing' | 'open' | 'active' | 'closed';

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

// ─── Session Metadata ────────────────────────────────────────────────────

export interface BoardroomSessionMetadata {
  entity_references?: EntityReference[];
  attachments?: MediaAttachment[];
  preparation?: {
    assignments: PrepAssignment[];
    results: PrepResult[];
    status: PrepStatus;
    started_at?: string;
    completed_at?: string;
  };
  [key: string]: unknown; // allow additional ad-hoc fields
}

export interface BoardroomMessage {
  id: string;
  session_id: string;
  agent_id: string;
  content: string;
  reasoning: string | null;
  turn_number: number;
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
];

export function getSessionPreset(type: BoardroomSessionType): SessionTypePreset {
  return SESSION_TYPE_PRESETS.find((p) => p.type === type) || SESSION_TYPE_PRESETS[SESSION_TYPE_PRESETS.length - 1];
}
