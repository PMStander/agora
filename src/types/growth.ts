// ─── Agent Growth Types ─────────────────────────────────────────────────────

// ── Reflection Types ──

export type ReflectionTrigger = 'post_task' | 'post_session' | 'daily' | 'manual';
export type ReflectionSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface AgentReflection {
  id: string;
  agent_id: string;
  trigger: ReflectionTrigger;
  sentiment: ReflectionSentiment;
  tags: string[];
  content: string;
  lessons_learned: string[];
  areas_for_improvement: string[];
  confidence_score: number;
  source_mission_id: string | null;
  source_session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Evolution Report Types ──

export type EvolutionReportType = 'individual' | 'team';
export type EvolutionReportStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type EvolutionReportTriggeredBy = 'manual' | 'scheduled';

export interface EvolutionSignal {
  signal_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  agent_id?: string;
  evidence: string[];
}

export interface EvolutionRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
  target_agent_id?: string;
  rationale: string;
}

export interface EvolutionHealthSummary {
  overall_score: number;
  top_strengths: string[];
  top_concerns: string[];
  reflection_count: number;
  avg_sentiment_score: number;
}

export interface EvolutionReport {
  id: string;
  agent_id: string | null;
  report_type: EvolutionReportType;
  status: EvolutionReportStatus;
  period_start: string;
  period_end: string;
  signals: EvolutionSignal[];
  recommendations: EvolutionRecommendation[];
  health_summary: EvolutionHealthSummary;
  raw_analysis: string | null;
  triggered_by: EvolutionReportTriggeredBy;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

// ── Config Maps ──

export const SENTIMENT_CONFIG: Record<ReflectionSentiment, { label: string; color: string }> = {
  positive: { label: 'Positive', color: 'text-emerald-400' },
  neutral: { label: 'Neutral', color: 'text-zinc-400' },
  negative: { label: 'Negative', color: 'text-red-400' },
  mixed: { label: 'Mixed', color: 'text-amber-400' },
};

export const TRIGGER_CONFIG: Record<ReflectionTrigger, { label: string }> = {
  post_task: { label: 'Post-Task' },
  post_session: { label: 'Post-Session' },
  daily: { label: 'Daily' },
  manual: { label: 'Manual' },
};

export const REPORT_STATUS_CONFIG: Record<EvolutionReportStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-zinc-400' },
  generating: { label: 'Generating', color: 'text-blue-400' },
  completed: { label: 'Completed', color: 'text-emerald-400' },
  failed: { label: 'Failed', color: 'text-red-400' },
};
