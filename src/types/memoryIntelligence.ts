// ─── Memory Intelligence Types ──────────────────────────────────────────────

export type EmbeddingSourceType = 'daily_note' | 'long_term_memory' | 'context_document' | 'mission_output' | 'chat_message' | 'review_feedback';
export type PatternType = 'preference' | 'mistake' | 'success_pattern' | 'rejection_reason' | 'style_guide';
export type PriorityScope = 'global' | 'team' | 'agent';
export type PriorityStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type SummaryType = 'hourly' | 'daily' | 'weekly';

// ─── Memory Embeddings ──────────────────────────────────────────────────────

export interface MemoryEmbedding {
  id: string;
  source_type: EmbeddingSourceType;
  source_id: string;
  agent_id: string;
  content_text: string;
  embedding?: number[];  // 384-dimensional vector, optional in client (large)
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SemanticSearchResult {
  id: string;
  source_type: EmbeddingSourceType;
  source_id: string;
  agent_id: string;
  content_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface SemanticSearchOptions {
  agentId?: string;
  sourceTypes?: EmbeddingSourceType[];
  threshold?: number;  // min similarity, default 0.5
  limit?: number;      // max results, default 10
}

// ─── Agent Learned Patterns ──────────────────────────────────────────────────

export interface AgentLearnedPattern {
  id: string;
  agent_id: string;
  pattern_type: PatternType;
  pattern: string;
  source_count: number;
  confidence: number;  // 0..1
  examples: PatternExample[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatternExample {
  date: string;
  context: string;
  outcome: 'approved' | 'rejected' | 'revised';
}

// ─── Shared Priorities ──────────────────────────────────────────────────────

export interface SharedPriority {
  id: string;
  priority_rank: number;
  title: string;
  description: string | null;
  set_by: string;  // 'user' or agent_id
  scope: PriorityScope;
  scope_target: string | null;
  status: PriorityStatus;
  created_at: string;
  updated_at: string;
}

// ─── Memory Summaries ──────────────────────────────────────────────────────

export interface MemorySummary {
  id: string;
  agent_id: string;
  summary_type: SummaryType;
  period_start: string;
  period_end: string;
  topics: string[];
  decisions: SummaryDecision[];
  action_items: SummaryActionItem[];
  summary_text: string;
  stats: SummaryStats;
  created_at: string;
}

export interface SummaryDecision {
  description: string;
  reasoning?: string;
  agent_id?: string;
}

export interface SummaryActionItem {
  action: string;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to?: string;
}

export interface SummaryStats {
  user_messages?: number;
  assistant_messages?: number;
  tool_calls?: number;
  missions_started?: number;
  missions_completed?: number;
}

// ─── Cross-Signal Detection ──────────────────────────────────────────────────

export interface CrossSignal {
  entity: string;         // company name, contact name, or topic
  entity_type: 'company' | 'contact' | 'topic' | 'keyword';
  agents: string[];       // which agents flagged this entity
  contexts: CrossSignalContext[];
  strength: number;       // number of independent agent mentions
  first_seen: string;
  last_seen: string;
}

export interface CrossSignalContext {
  agent_id: string;
  source_type: EmbeddingSourceType;
  snippet: string;
  timestamp: string;
}
