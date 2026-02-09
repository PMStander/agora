// ─── Plan Engine ─────────────────────────────────────────────────────────────
// Core execution algorithms for phase-gated, DAG-based mission plans.
// Pure functions — no Supabase calls. Callers persist the returned mutations.

import type {
  PlanPhase,
  PlanTask,
  PlanTaskEdge,
  PlanTestResult,
  CircuitBreakerConfig,
  CircuitBreakerResult,
  PhaseGateResult,
} from '../types/missionPlan';

// ─── Phase Activation ────────────────────────────────────────────────────────

/**
 * Activate a plan: set phase 0 to 'active' and mark its unblocked tasks as 'ready'.
 * Returns the mutations to apply (phase update + task updates).
 */
export function activatePlan(
  phases: PlanPhase[],
  tasks: PlanTask[],
  edges: PlanTaskEdge[],
): { phaseUpdates: Array<{ id: string; status: 'active'; started_at: string }>; taskUpdates: Array<{ id: string; status: 'ready' }> } {
  const sorted = [...phases].sort((a, b) => a.phase_index - b.phase_index);
  const firstPhase = sorted[0];
  if (!firstPhase) return { phaseUpdates: [], taskUpdates: [] };

  const now = new Date().toISOString();
  const phaseUpdates = [{ id: firstPhase.id, status: 'active' as const, started_at: now }];

  const readyTasks = getReadyTasks(firstPhase.id, tasks, edges);
  const taskUpdates = readyTasks.map((t) => ({ id: t.id, status: 'ready' as const }));

  // Tasks in this phase that are NOT ready remain 'pending' (no update needed)
  return { phaseUpdates, taskUpdates };
}

/**
 * Check if the current phase gate is satisfied, and if so return the next phase
 * to activate along with its ready tasks.
 */
export function tryActivateNextPhase(
  phases: PlanPhase[],
  tasks: PlanTask[],
  edges: PlanTaskEdge[],
  testResults?: PlanTestResult[],
): { nextPhase: PlanPhase | null; completedPhase: PlanPhase | null; readyTasks: PlanTask[] } {
  const sorted = [...phases].sort((a, b) => a.phase_index - b.phase_index);
  const activePhase = sorted.find((p) => p.status === 'active');
  if (!activePhase) return { nextPhase: null, completedPhase: null, readyTasks: [] };

  const phaseTasks = tasks.filter((t) => t.phase_id === activePhase.id);
  const gateResult = isPhaseGateSatisfied(activePhase, phaseTasks, testResults);
  if (!gateResult.satisfied) return { nextPhase: null, completedPhase: null, readyTasks: [] };

  const nextPhase = sorted.find((p) => p.phase_index === activePhase.phase_index + 1 && p.status === 'pending');
  if (!nextPhase) return { nextPhase: null, completedPhase: activePhase, readyTasks: [] };

  const readyTasks = getReadyTasks(nextPhase.id, tasks, edges);
  return { nextPhase, completedPhase: activePhase, readyTasks };
}

// ─── Phase Gate Evaluation ───────────────────────────────────────────────────

export function isPhaseGateSatisfied(
  phase: PlanPhase,
  phaseTasks: PlanTask[],
  testResults?: PlanTestResult[],
): PhaseGateResult {
  if (phaseTasks.length === 0) {
    return { satisfied: true, reason: 'Phase has no tasks.' };
  }

  switch (phase.gate_type) {
    case 'all_complete': {
      const incomplete = phaseTasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
      if (incomplete.length === 0) {
        return { satisfied: true, reason: null };
      }
      return {
        satisfied: false,
        reason: `${incomplete.length} task(s) not yet complete: ${incomplete.map((t) => t.key).join(', ')}`,
      };
    }

    case 'review_approved': {
      const needsReview = phaseTasks.filter((t) => t.review_enabled);
      if (needsReview.length === 0) {
        // Fall back to all_complete if no reviewable tasks
        const incomplete = phaseTasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
        return incomplete.length === 0
          ? { satisfied: true, reason: null }
          : { satisfied: false, reason: `${incomplete.length} task(s) not yet complete.` };
      }
      const notDone = needsReview.filter((t) => t.status !== 'done');
      if (notDone.length > 0) {
        return { satisfied: false, reason: `${notDone.length} reviewed task(s) pending: ${notDone.map((t) => t.key).join(', ')}` };
      }
      return { satisfied: true, reason: null };
    }

    case 'test_pass': {
      const phaseTests = (testResults || []).filter((tr) => tr.phase_id === phase.id);
      if (phaseTests.length === 0) {
        return { satisfied: false, reason: 'No test results submitted for this phase.' };
      }
      const failing = phaseTests.filter((tr) => !tr.passed);
      if (failing.length > 0) {
        return { satisfied: false, reason: `${failing.length} test(s) failing: ${failing.map((tr) => tr.test_name).join(', ')}` };
      }
      // Tests pass, but tasks must also be complete
      const incomplete = phaseTasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
      return incomplete.length === 0
        ? { satisfied: true, reason: null }
        : { satisfied: false, reason: `Tests pass but ${incomplete.length} task(s) incomplete.` };
    }

    case 'manual_approval': {
      // Manual gates are never auto-satisfied — the caller must explicitly advance.
      return { satisfied: false, reason: 'Awaiting manual approval.' };
    }

    default:
      return { satisfied: false, reason: `Unknown gate type: ${phase.gate_type}` };
  }
}

// ─── Task Readiness (DAG) ────────────────────────────────────────────────────

/**
 * Find tasks in the given phase whose blocking edges are all satisfied
 * (source task is 'done' or 'skipped'). Only considers 'blocks' edges.
 */
export function getReadyTasks(
  phaseId: string,
  allTasks: PlanTask[],
  edges: PlanTaskEdge[],
): PlanTask[] {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const phaseTasks = allTasks.filter((t) => t.phase_id === phaseId && t.status === 'pending');

  return phaseTasks.filter((task) => {
    const blockingEdges = edges.filter((e) => e.target_task_id === task.id && e.edge_type === 'blocks');
    return blockingEdges.every((e) => {
      const source = taskMap.get(e.source_task_id);
      return source && (source.status === 'done' || source.status === 'skipped');
    });
  });
}

// ─── Intra-Phase Task Readiness ─────────────────────────────────────────────

/**
 * Re-evaluate task readiness within an active phase after a task completes.
 * This enables intra-phase dependencies - tasks within the same phase can
 * depend on each other and become ready when their dependencies complete.
 * 
 * Call this when a task's status changes to 'done' or 'skipped' to find
 * any newly unblocked tasks in the same phase.
 */
export function reevaluateTaskReadiness(
  completedTaskId: string,
  allTasks: PlanTask[],
  edges: PlanTaskEdge[],
): PlanTask[] {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const completedTask = taskMap.get(completedTaskId);
  
  if (!completedTask) return [];
  
  // Find all tasks in the same phase that are still pending
  const phaseTasks = allTasks.filter(
    (t) => t.phase_id === completedTask.phase_id && t.status === 'pending'
  );
  
  // Check which ones are now ready (all blocking dependencies satisfied)
  const newlyReady: PlanTask[] = [];
  
  for (const task of phaseTasks) {
    const blockingEdges = edges.filter(
      (e) => e.target_task_id === task.id && e.edge_type === 'blocks'
    );
    
    const allDepsSatisfied = blockingEdges.every((e) => {
      const source = taskMap.get(e.source_task_id);
      return source && (source.status === 'done' || source.status === 'skipped');
    });
    
    if (allDepsSatisfied) {
      newlyReady.push(task);
    }
  }
  
  return newlyReady;
}

// ─── Context Injection ───────────────────────────────────────────────────────

/**
 * Build input_context for a task by collecting output from upstream tasks
 * connected by 'blocks' or 'informs' edges.
 */
export function injectUpstreamContext(
  task: PlanTask,
  allTasks: PlanTask[],
  edges: PlanTaskEdge[],
): Record<string, string> {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const inboundEdges = edges.filter((e) => e.target_task_id === task.id);
  const context: Record<string, string> = {};

  for (const edge of inboundEdges) {
    const source = taskMap.get(edge.source_task_id);
    if (!source || !source.output_text) continue;
    context[source.key] = source.output_text;
  }

  return context;
}

/**
 * Format input_context into a string section suitable for inclusion in an agent prompt.
 */
export function buildContextSection(inputContext: Record<string, string> | null): string {
  if (!inputContext || Object.keys(inputContext).length === 0) return '';

  const sections = Object.entries(inputContext).map(
    ([key, value]) => `### Output from "${key}"\n${value}`,
  );

  return `## Upstream Context\n\n${sections.join('\n\n')}`;
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────

/**
 * Check whether the mission should stop based on failure counts and policy.
 */
export function shouldCircuitBreak(
  phases: PlanPhase[],
  tasks: PlanTask[],
  config: CircuitBreakerConfig,
): CircuitBreakerResult {
  const activePhase = phases.find((p) => p.status === 'active');
  if (!activePhase) return { action: 'none', reason: null };

  const phaseTasks = tasks.filter((t) => t.phase_id === activePhase.id);
  const failedInPhase = phaseTasks.filter((t) => t.status === 'failed');

  if (failedInPhase.length === 0) return { action: 'none', reason: null };

  // Check max_phase_failures threshold
  if (failedInPhase.length >= config.max_phase_failures) {
    if (config.on_task_failure === 'stop_mission') {
      return {
        action: 'stop_mission',
        reason: `${failedInPhase.length} task(s) failed in phase "${activePhase.title}" (max: ${config.max_phase_failures}). Policy: stop_mission.`,
      };
    }
    if (config.on_task_failure === 'stop_phase') {
      return {
        action: 'stop_phase',
        reason: `${failedInPhase.length} task(s) failed in phase "${activePhase.title}" (max: ${config.max_phase_failures}). Policy: stop_phase.`,
      };
    }
  }

  // Individual failure check (before threshold)
  if (config.on_task_failure === 'stop_mission' && failedInPhase.length > 0) {
    return {
      action: 'stop_mission',
      reason: `Task "${failedInPhase[0].key}" failed. Policy: stop_mission.`,
    };
  }

  return { action: 'none', reason: null };
}
