// ─── Mission Plan Types ──────────────────────────────────────────────────────
// Structured plan engine types for phase-gated, DAG-based mission execution.

// ─── Status Enums ────────────────────────────────────────────────────────────

export type PlanStatus = 'draft' | 'approved' | 'superseded' | 'cancelled';

export type PhaseGateType = 'all_complete' | 'review_approved' | 'test_pass' | 'manual_approval';

export type PhaseStatus = 'pending' | 'active' | 'blocked' | 'completed' | 'failed' | 'skipped';

export type PlanTaskStatus = 'pending' | 'ready' | 'in_progress' | 'review' | 'done' | 'failed' | 'skipped';

export type EdgeType = 'blocks' | 'informs';

// ─── Core Interfaces ─────────────────────────────────────────────────────────

export interface OutputArtifact {
  key: string;
  label: string;
  mime_type: string;
  url: string | null;
  content: string | null;
}

export interface PlanTask {
  id: string;
  plan_id: string;
  phase_id: string;
  key: string;
  title: string;
  instructions: string;
  agent_id: string;
  status: PlanTaskStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  domains: string[];
  review_enabled: boolean;
  review_agent_id: string | null;
  max_revisions: number;
  revision_round: number;
  input_context: Record<string, string> | null;
  output_text: string | null;
  output_artifacts: OutputArtifact[];
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlanTaskEdge {
  id: string;
  plan_id: string;
  source_task_id: string;
  target_task_id: string;
  edge_type: EdgeType;
  created_at: string;
}

export interface PlanPhase {
  id: string;
  plan_id: string;
  phase_index: number;
  title: string;
  description: string | null;
  gate_type: PhaseGateType;
  status: PhaseStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionPlan {
  id: string;
  mission_id: string;
  version: number;
  status: PlanStatus;
  title: string;
  description: string | null;
  circuit_breaker_config: CircuitBreakerConfig;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Execution Tracking ──────────────────────────────────────────────────────

export interface PlanTaskRun {
  id: string;
  task_id: string;
  plan_id: string;
  agent_id: string;
  phase: 'primary' | 'review';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  output_text: string | null;
  error_message: string | null;
}

export interface PlanTestResult {
  id: string;
  task_id: string;
  plan_id: string;
  phase_id: string;
  test_name: string;
  passed: boolean;
  output: string | null;
  created_at: string;
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

export type FailurePolicy = 'stop_phase' | 'stop_mission' | 'continue';

export interface CircuitBreakerConfig {
  on_task_failure: FailurePolicy;
  max_phase_failures: number;
}

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  on_task_failure: 'stop_phase',
  max_phase_failures: 2,
};

// ─── Planner Agent Output ────────────────────────────────────────────────────
// Shape expected from the planner agent before normalization into DB rows.

export interface PlannerPhaseOutput {
  title: string;
  description?: string;
  gate_type?: PhaseGateType;
  tasks: PlannerTaskOutput[];
}

export interface PlannerTaskOutput {
  key: string;
  title: string;
  instructions: string;
  agent_id: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  domains?: string[];
  depends_on?: string[];
  informs?: string[];
  review_enabled?: boolean;
  review_agent_id?: string;
  max_revisions?: number;
  output_artifacts?: Array<{ key: string; label: string; mime_type: string }>;
}

export interface PlannerOutput {
  title: string;
  description?: string;
  circuit_breaker?: Partial<CircuitBreakerConfig>;
  phases: PlannerPhaseOutput[];
}

// ─── Normalization Result ────────────────────────────────────────────────────
// Rows ready for Supabase insert after parsing + validation.

export interface NormalizedPlanRows {
  plan: Omit<MissionPlan, 'id' | 'created_at' | 'updated_at'>;
  phases: Omit<PlanPhase, 'id' | 'created_at' | 'updated_at'>[];
  tasks: Omit<PlanTask, 'id' | 'created_at' | 'updated_at'>[];
  edges: Omit<PlanTaskEdge, 'id' | 'created_at'>[];
}

// ─── Engine Results ──────────────────────────────────────────────────────────

export type CircuitBreakerAction = 'none' | 'stop_phase' | 'stop_mission';

export interface CircuitBreakerResult {
  action: CircuitBreakerAction;
  reason: string | null;
}

export interface PhaseGateResult {
  satisfied: boolean;
  reason: string | null;
}
