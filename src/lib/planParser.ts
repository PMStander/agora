// ─── Plan Parser ─────────────────────────────────────────────────────────────
// Parse planner agent output into validated, normalized DB rows.

import { AGENTS } from '../types/supabase';
import {
  DEFAULT_CIRCUIT_BREAKER,
  type CircuitBreakerConfig,
  type NormalizedPlanRows,
  type PlannerOutput,
  type PlannerPhaseOutput,
} from '../types/missionPlan';

// ─── JSON Extraction ─────────────────────────────────────────────────────────

/**
 * Extract a JSON object from raw agent text. Handles:
 * - Fenced ```json blocks
 * - Raw JSON strings
 */
export function parsePlannerOutput(rawText: string): PlannerOutput | null {
  const fenced = rawText.match(/```json\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], rawText].filter((v): v is string => Boolean(v));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Quick shape check: must have a phases array
        if (Array.isArray(parsed.phases)) {
          return parsed as PlannerOutput;
        }
      }
    } catch {
      // Try next candidate
    }
  }

  return null;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface PlanValidationError {
  path: string;
  message: string;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: PlanValidationError[];
}

const VALID_AGENT_IDS = new Set(AGENTS.map((a) => a.id));
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const VALID_GATE_TYPES = new Set(['all_complete', 'review_approved', 'test_pass', 'manual_approval']);

export function validatePlannerOutput(parsed: PlannerOutput): PlanValidationResult {
  const errors: PlanValidationError[] = [];

  if (!parsed.title || typeof parsed.title !== 'string') {
    errors.push({ path: 'title', message: 'Plan must have a non-empty title.' });
  }

  if (!Array.isArray(parsed.phases) || parsed.phases.length === 0) {
    errors.push({ path: 'phases', message: 'Plan must have at least one phase.' });
    return { valid: false, errors };
  }

  // Collect all task keys across phases for cross-reference validation
  const allTaskKeys = new Set<string>();
  const duplicateKeys: string[] = [];

  for (let pi = 0; pi < parsed.phases.length; pi++) {
    const phase = parsed.phases[pi];
    const phasePath = `phases[${pi}]`;

    if (!phase.title || typeof phase.title !== 'string') {
      errors.push({ path: `${phasePath}.title`, message: 'Phase must have a non-empty title.' });
    }

    if (phase.gate_type && !VALID_GATE_TYPES.has(phase.gate_type)) {
      errors.push({ path: `${phasePath}.gate_type`, message: `Invalid gate_type "${phase.gate_type}".` });
    }

    if (!Array.isArray(phase.tasks) || phase.tasks.length === 0) {
      errors.push({ path: `${phasePath}.tasks`, message: 'Phase must have at least one task.' });
      continue;
    }

    for (let ti = 0; ti < phase.tasks.length; ti++) {
      const task = phase.tasks[ti];
      const taskPath = `${phasePath}.tasks[${ti}]`;

      if (!task.key || typeof task.key !== 'string') {
        errors.push({ path: `${taskPath}.key`, message: 'Task must have a non-empty key.' });
      } else if (allTaskKeys.has(task.key)) {
        duplicateKeys.push(task.key);
      } else {
        allTaskKeys.add(task.key);
      }

      if (!task.title || typeof task.title !== 'string') {
        errors.push({ path: `${taskPath}.title`, message: 'Task must have a non-empty title.' });
      }

      if (!task.instructions || typeof task.instructions !== 'string') {
        errors.push({ path: `${taskPath}.instructions`, message: 'Task must have non-empty instructions.' });
      }

      if (!task.agent_id || !VALID_AGENT_IDS.has(task.agent_id)) {
        errors.push({ path: `${taskPath}.agent_id`, message: `Unknown agent_id "${task.agent_id}".` });
      }

      if (task.priority && !VALID_PRIORITIES.has(task.priority)) {
        errors.push({ path: `${taskPath}.priority`, message: `Invalid priority "${task.priority}".` });
      }

      if (task.review_enabled && task.review_agent_id && !VALID_AGENT_IDS.has(task.review_agent_id)) {
        errors.push({ path: `${taskPath}.review_agent_id`, message: `Unknown review_agent_id "${task.review_agent_id}".` });
      }
    }
  }

  for (const key of duplicateKeys) {
    errors.push({ path: 'tasks', message: `Duplicate task key "${key}".` });
  }

  // Validate dependency references
  for (const phase of parsed.phases) {
    if (!Array.isArray(phase.tasks)) continue;
    for (const task of phase.tasks) {
      for (const dep of task.depends_on || []) {
        if (!allTaskKeys.has(dep)) {
          errors.push({ path: `task[${task.key}].depends_on`, message: `References unknown task key "${dep}".` });
        }
        if (dep === task.key) {
          errors.push({ path: `task[${task.key}].depends_on`, message: 'Task depends on itself.' });
        }
      }
      for (const inf of task.informs || []) {
        if (!allTaskKeys.has(inf)) {
          errors.push({ path: `task[${task.key}].informs`, message: `References unknown task key "${inf}".` });
        }
      }
    }
  }

  // Cycle detection via DFS across all tasks
  const cycleErrors = detectCycles(parsed.phases);
  for (const cycle of cycleErrors) {
    errors.push({ path: 'dependencies', message: cycle });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Cycle Detection ─────────────────────────────────────────────────────────

function detectCycles(phases: PlannerPhaseOutput[]): string[] {
  const errors: string[] = [];
  const adjMap = new Map<string, string[]>();

  for (const phase of phases) {
    if (!Array.isArray(phase.tasks)) continue;
    for (const task of phase.tasks) {
      adjMap.set(task.key, [...(task.depends_on || [])]);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(key: string, path: string[]): boolean {
    if (inStack.has(key)) {
      const cycleStart = path.indexOf(key);
      const cycle = path.slice(cycleStart).concat(key);
      errors.push(`Circular dependency: ${cycle.join(' -> ')}`);
      return true;
    }
    if (visited.has(key)) return false;
    visited.add(key);
    inStack.add(key);
    for (const dep of adjMap.get(key) || []) {
      if (dfs(dep, [...path, key])) return true;
    }
    inStack.delete(key);
    return false;
  }

  for (const key of Array.from(adjMap.keys())) {
    if (!visited.has(key)) {
      dfs(key, []);
    }
  }

  return errors;
}

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * Convert validated PlannerOutput into DB-ready rows for:
 * mission_plans, plan_phases, plan_tasks, plan_task_edges.
 *
 * Uses placeholder IDs (plan_<idx>, phase_<idx>, task_<key>) that the
 * caller replaces with real UUIDs before inserting.
 */
export function normalizePlanToRows(
  plannerOutput: PlannerOutput,
  missionId: string,
  version: number = 1,
  createdBy: string = 'planner',
): NormalizedPlanRows {
  const planId = `plan_0`;

  const cbConfig: CircuitBreakerConfig = {
    ...DEFAULT_CIRCUIT_BREAKER,
    ...(plannerOutput.circuit_breaker || {}),
  };

  const plan: NormalizedPlanRows['plan'] = {
    mission_id: missionId,
    version,
    status: 'draft',
    title: plannerOutput.title,
    description: plannerOutput.description || null,
    circuit_breaker_config: cbConfig,
    created_by: createdBy,
    approved_by: null,
    approved_at: null,
  };

  const phases: NormalizedPlanRows['phases'] = [];
  const tasks: NormalizedPlanRows['tasks'] = [];
  const edges: NormalizedPlanRows['edges'] = [];

  // Map task keys to placeholder IDs for edge resolution
  const taskKeyToId = new Map<string, string>();
  let globalTaskOrder = 0;

  for (let pi = 0; pi < plannerOutput.phases.length; pi++) {
    const phaseInput = plannerOutput.phases[pi];
    const phaseId = `phase_${pi}`;

    phases.push({
      plan_id: planId,
      phase_index: pi,
      title: phaseInput.title,
      description: phaseInput.description || null,
      gate_type: phaseInput.gate_type || 'all_complete',
      status: 'pending',
      started_at: null,
      completed_at: null,
    });

    for (let ti = 0; ti < (phaseInput.tasks || []).length; ti++) {
      const taskInput = phaseInput.tasks[ti];
      const taskId = `task_${taskInput.key}`;
      taskKeyToId.set(taskInput.key, taskId);

      tasks.push({
        plan_id: planId,
        phase_id: phaseId,
        key: taskInput.key,
        title: taskInput.title,
        instructions: taskInput.instructions,
        agent_id: taskInput.agent_id,
        status: 'pending',
        priority: taskInput.priority || 'medium',
        domains: taskInput.domains || [],
        review_enabled: taskInput.review_enabled || false,
        review_agent_id: taskInput.review_agent_id || null,
        max_revisions: taskInput.max_revisions ?? 1,
        revision_round: 0,
        input_context: null,
        output_text: null,
        output_artifacts: (taskInput.output_artifacts || []).map((a) => ({
          ...a,
          url: null,
          content: null,
        })),
        error_message: null,
        started_at: null,
        completed_at: null,
        sort_order: globalTaskOrder++,
      });
    }
  }

  // Build edges from depends_on (blocks) and informs
  for (const phase of plannerOutput.phases) {
    for (const taskInput of phase.tasks || []) {
      const targetId = taskKeyToId.get(taskInput.key);
      if (!targetId) continue;

      for (const dep of taskInput.depends_on || []) {
        const sourceId = taskKeyToId.get(dep);
        if (!sourceId) continue;
        edges.push({
          plan_id: planId,
          source_task_id: sourceId,
          target_task_id: targetId,
          edge_type: 'blocks',
        });
      }

      for (const inf of taskInput.informs || []) {
        const informedId = taskKeyToId.get(inf);
        if (!informedId) continue;
        edges.push({
          plan_id: planId,
          source_task_id: targetId,
          target_task_id: informedId,
          edge_type: 'informs',
        });
      }
    }
  }

  return { plan, phases, tasks, edges };
}
