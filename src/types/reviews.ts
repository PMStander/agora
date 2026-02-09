// ─── Performance Review System Types ─────────────────────────────────────────

export type ReviewTrigger = 'manual' | 'scheduled' | 'milestone' | 'alert';
export type ReviewStatus = 'collecting' | 'narrative_ready' | 'user_review' | 'finalized';
export type LevelRecommendation = 'maintain' | 'promote' | 'demote';
export type ReviewCadence = 'weekly' | 'monthly' | 'quarterly';

/** Star rating from 1..5 */
export type StarRating = 1 | 2 | 3 | 4 | 5;

// ─── Metrics (auto-collected) ────────────────────────────────────────────────

export interface TaskCompletionMetrics {
  total_assigned: number;
  completed: number;
  failed: number;
  timed_out: number;
  completion_rate: number; // 0..1
}

export interface QualityMetrics {
  review_pass_rate: number; // 0..1  (tasks approved on first round)
  avg_revision_rounds: number;
  proof_verified_rate: number; // 0..1  (proof reports that came back 'verified')
}

export interface SpeedMetrics {
  avg_completion_minutes: number;
  avg_vs_estimate_ratio: number; // <1 = faster than estimate, >1 = slower
  fastest_task_minutes: number;
  slowest_task_minutes: number;
}

export interface CollaborationMetrics {
  handoffs_initiated: number;
  handoffs_received: number;
  handoff_success_rate: number; // 0..1
  help_provided_count: number;
  cross_team_collaborations: number;
}

export interface DomainPerformance {
  domain: string;
  tasks_completed: number;
  avg_quality_score: number; // 0..1
  avg_speed_ratio: number;
}

export interface GuardrailMetrics {
  violations: number;
  near_misses: number;
  compliance_rate: number; // 0..1
}

export interface ReviewMetrics {
  period_start: string; // ISO timestamp
  period_end: string;
  task_completion: TaskCompletionMetrics;
  quality: QualityMetrics;
  speed: SpeedMetrics;
  collaboration: CollaborationMetrics;
  domain_breakdown: DomainPerformance[];
  guardrails: GuardrailMetrics;
}

// ─── User Ratings (manual during review) ─────────────────────────────────────

export interface ReviewRatings {
  task_completion: StarRating;
  quality: StarRating;
  speed: StarRating;
  collaboration: StarRating;
  domain_expertise: StarRating;
  overall: StarRating;
}

// ─── Review Record ───────────────────────────────────────────────────────────

export interface PerformanceReview {
  id: string;
  agent_id: string;
  trigger: ReviewTrigger;
  status: ReviewStatus;
  period_start: string;
  period_end: string;

  // Step 1: Auto-collected metrics
  metrics: ReviewMetrics;

  // Step 2: AI-generated narrative
  narrative: string | null;

  // Step 3: User ratings and notes
  ratings: ReviewRatings | null;
  user_notes: string | null;

  // Step 4: Level recommendation
  level_recommendation: LevelRecommendation | null;
  level_justification: string | null;

  // Step 5: Feedback for agent (stored in profile)
  agent_feedback: string | null;

  // Step 6: Outcome
  level_change_applied: boolean;
  previous_level: number | null;
  new_level: number | null;

  created_at: string;
  finalized_at: string | null;
}

// ─── Level Change History ────────────────────────────────────────────────────

export type LevelChangeReason = 'review_promotion' | 'review_demotion' | 'initial_hire' | 'manual_adjustment';

export interface LevelChangeRecord {
  id: string;
  agent_id: string;
  review_id: string | null; // null if manual or initial
  previous_level: number;
  new_level: number;
  reason: LevelChangeReason;
  justification: string;
  changed_by: string; // 'user' or 'system'
  created_at: string;
}

// ─── Agent Feedback Log ──────────────────────────────────────────────────────

export interface AgentFeedbackEntry {
  id: string;
  agent_id: string;
  review_id: string | null;
  feedback_type: 'review_summary' | 'praise' | 'improvement_area' | 'directive';
  content: string;
  acknowledged: boolean;
  created_at: string;
}

// ─── Review Schedule ─────────────────────────────────────────────────────────

export interface ReviewSchedule {
  id: string;
  agent_id: string;
  cadence: ReviewCadence;
  next_review_at: string;
  milestone_threshold: number | null; // trigger after N completed missions
  quality_alert_threshold: number | null; // trigger when quality < this (0..1)
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
