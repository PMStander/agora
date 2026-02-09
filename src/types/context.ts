// ─── Shared Context System Types ─────────────────────────────────────────────

export type AccessLevel = 'read' | 'write' | 'admin';
export type MemoryTier = 'daily_notes' | 'long_term' | 'project_context';
export type HandoffStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'timed_out';
export type ContextDocType = 'access' | 'context' | 'research' | 'decision_log';

// ─── Project Context ─────────────────────────────────────────────────────────

export interface ProjectContext {
  id: string;
  project_id: string; // links to mission_id or a dedicated project
  title: string;
  last_updated_by_agent_id: string;
  last_updated_at: string;
  created_at: string;
}

/** ACCESS.md equivalent: which agents can touch this project context */
export interface ContextAccessEntry {
  id: string;
  project_context_id: string;
  agent_id: string;
  access_level: AccessLevel;
  granted_by: string; // 'user' or agent_id
  granted_at: string;
}

/** CONTEXT.md equivalent: the living document of learnings / decisions / state */
export interface ContextDocument {
  id: string;
  project_context_id: string;
  doc_type: ContextDocType;
  title: string;
  content: string; // markdown
  last_updated_by_agent_id: string;
  version: number; // incremented on every save for optimistic locking
  created_at: string;
  updated_at: string;
}

/** An individual revision to a context document (append-only audit trail) */
export interface ContextRevision {
  id: string;
  context_document_id: string;
  agent_id: string;
  diff_summary: string; // human-readable description of what changed
  content_snapshot: string; // full content at this revision
  version: number;
  created_at: string;
}

// ─── Agent Registry ──────────────────────────────────────────────────────────

export interface AgentRegistryEntry {
  agent_id: string;
  display_name: string;
  role: string;
  team_id: string;
  domains: string[];
  skills: string[]; // more granular than domains, e.g. "react", "sql", "copywriting"
  availability: 'available' | 'busy' | 'offline';
  current_task_id: string | null;
  current_mission_id: string | null;
  level: number;
  total_missions_completed: number;
  avg_quality_score: number; // 0..1, rolling
  response_time_avg_minutes: number;
  last_active_at: string;
}

// ─── Handoff Protocol ────────────────────────────────────────────────────────

export interface HandoffRequest {
  id: string;
  requesting_agent_id: string;
  target_agent_id: string;
  task_id: string | null;
  mission_id: string | null;
  reason: string; // why the handoff is needed
  context_summary: string; // what the target agent needs to know
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: HandoffStatus;
  accepted_at: string | null;
  completed_at: string | null;
  outcome: string | null; // what happened, filled on completion
  time_taken_minutes: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Three-Tier Memory ──────────────────────────────────────────────────────

/** Daily Notes: raw activity log per agent per day */
export interface DailyNote {
  id: string;
  agent_id: string;
  date: string; // YYYY-MM-DD
  entries: DailyNoteEntry[];
  created_at: string;
  updated_at: string;
}

export interface DailyNoteEntry {
  timestamp: string;
  type: 'task_started' | 'task_completed' | 'insight' | 'error' | 'handoff' | 'decision' | 'observation';
  content: string;
  related_task_id: string | null;
  related_mission_id: string | null;
}

/** Long-term Memory: curated insights, patterns, preferences per agent */
export interface LongTermMemory {
  id: string;
  agent_id: string;
  category: 'insight' | 'pattern' | 'preference' | 'skill_learned' | 'mistake_learned';
  title: string;
  content: string;
  source_daily_note_id: string | null; // which daily note it was promoted from
  source_task_id: string | null;
  relevance_score: number; // 0..1, decays over time, boosted when referenced
  tags: string[];
  created_at: string;
  last_referenced_at: string;
}

/** Cross-project insight: flagged when an agent learns something applicable elsewhere */
export interface CrossProjectInsight {
  id: string;
  source_agent_id: string;
  source_project_context_id: string;
  insight: string;
  applicable_domains: string[];
  propagated_to: string[]; // project_context_ids where this was shared
  created_at: string;
}
