import { AGENTS, type Mission, type MissionPriority } from '../types/supabase';

export interface MissionPlanTaskBlueprint {
  key: string;
  title: string;
  instructions: string;
  agent_id: string;
  priority: MissionPriority;
  due_offset_minutes: number;
  depends_on: string[];
  domains: string[];
  review_enabled: boolean;
  review_agent_id: string | null;
  max_revisions: number;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  blueprints: MissionPlanTaskBlueprint[];
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      if (Array.isArray(parsed)) {
        return { missions: parsed };
      }
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function validAgentId(agentId: string | null | undefined, fallbackAgentId: string): string {
  if (agentId && AGENTS.some((agent) => agent.id === agentId)) return agentId;
  return fallbackAgentId;
}

function normalizeKey(raw: unknown, index: number): string {
  const key = String(raw || `task_${index + 1}`).trim();
  return key.length > 0 ? key : `task_${index + 1}`;
}

function toTaskArray(source: Record<string, unknown>): Record<string, unknown>[] {
  const tasks = Array.isArray(source.missions)
    ? source.missions
    : Array.isArray(source.tasks)
    ? source.tasks
    : Array.isArray(source.plan)
    ? source.plan
    : [];

  return tasks.filter((entry): entry is Record<string, unknown> => {
    return typeof entry === 'object' && entry !== null;
  });
}

export function parseMissionPlanTasks(planText: string, mission: Mission): MissionPlanTaskBlueprint[] {
  const parsed = parseJsonObject(planText);
  if (!parsed) return [];

  const tasks = toTaskArray(parsed);
  if (tasks.length === 0) return [];

  const normalized = tasks.map((entry, index) => {
    const key = normalizeKey(entry.key ?? entry.id, index);
    const title = String(entry.title || '').trim();
    const instructions = String(entry.instructions || entry.input_text || '').trim();
    const fallbackInstructions = mission.mission_statement || mission.input_text || mission.description || '';
    const dependsOn = Array.isArray(entry.depends_on)
      ? entry.depends_on.map((value) => String(value))
      : Array.isArray(entry.dependencies)
      ? entry.dependencies.map((value) => String(value))
      : [];

    const priority = typeof entry.priority === 'string'
      ? entry.priority as MissionPriority
      : mission.priority;

    return {
      key,
      title: title || `${mission.title} – Step ${index + 1}`,
      instructions: instructions || fallbackInstructions,
      agent_id: validAgentId(
        typeof entry.agent_id === 'string' ? entry.agent_id : null,
        mission.agent_id
      ),
      priority,
      due_offset_minutes: typeof entry.due_offset_minutes === 'number'
        ? entry.due_offset_minutes
        : index * 5,
      depends_on: dependsOn,
      domains: Array.isArray(entry.domains) ? entry.domains.map((value) => String(value)) : (mission.domains || []),
      review_enabled: entry.review_enabled === true,
      review_agent_id: entry.review_enabled === true && typeof entry.review_agent_id === 'string'
        ? validAgentId(entry.review_agent_id, mission.review_agent_id || mission.agent_id)
        : mission.review_enabled
        ? mission.review_agent_id
        : null,
      max_revisions: typeof entry.max_revisions === 'number'
        ? Math.max(0, entry.max_revisions)
        : mission.max_revisions,
    } satisfies MissionPlanTaskBlueprint;
  });

  const knownKeys = new Set(normalized.map((entry) => entry.key));
  return normalized.map((entry) => ({
    ...entry,
    depends_on: entry.depends_on.filter((key) => knownKeys.has(key) && key !== entry.key),
  }));
}

function detectCircularDependencies(blueprints: MissionPlanTaskBlueprint[]): string[] {
  const errors: string[] = [];
  const keySet = new Set(blueprints.map((b) => b.key));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const adjMap = new Map<string, string[]>();
  for (const b of blueprints) {
    adjMap.set(b.key, b.depends_on.filter((k) => keySet.has(k)));
  }

  function dfs(key: string, path: string[]): boolean {
    if (inStack.has(key)) {
      const cycleStart = path.indexOf(key);
      const cycle = path.slice(cycleStart).concat(key);
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
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

  for (const b of blueprints) {
    if (!visited.has(b.key)) {
      dfs(b.key, []);
    }
  }
  return errors;
}

export function validateMissionPlan(planText: string, mission: Mission): PlanValidationResult {
  const errors: string[] = [];

  const parsed = parseJsonObject(planText);
  if (!parsed) {
    return { valid: false, errors: ['Plan is not valid JSON.'], blueprints: [] };
  }

  const tasks = toTaskArray(parsed);
  if (tasks.length === 0) {
    return { valid: false, errors: ['Plan must contain at least one task (in a "missions", "tasks", or "plan" array).'], blueprints: [] };
  }

  // Check each task entry has required fields
  for (let i = 0; i < tasks.length; i++) {
    const entry = tasks[i];
    const key = String(entry.key ?? entry.id ?? '').trim();
    const title = String(entry.title || '').trim();
    const instructions = String(entry.instructions || entry.input_text || '').trim();

    if (!key) {
      errors.push(`Task ${i + 1}: missing "key" field.`);
    }
    if (!title) {
      errors.push(`Task ${i + 1}${key ? ` (${key})` : ''}: missing "title" field.`);
    }
    if (!instructions) {
      errors.push(`Task ${i + 1}${key ? ` (${key})` : ''}: missing "instructions" field.`);
    }
  }

  // Parse blueprints for further validation
  const blueprints = parseMissionPlanTasks(planText, mission);
  if (blueprints.length === 0 && errors.length === 0) {
    errors.push('Failed to parse any valid tasks from plan.');
    return { valid: false, errors, blueprints: [] };
  }

  // Check for duplicate keys
  const keyCounts = new Map<string, number>();
  for (const b of blueprints) {
    keyCounts.set(b.key, (keyCounts.get(b.key) || 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      errors.push(`Duplicate task key: "${key}" appears ${count} times.`);
    }
  }

  // Check depends_on references valid keys
  const knownKeys = new Set(blueprints.map((b) => b.key));
  for (let i = 0; i < tasks.length; i++) {
    const entry = tasks[i];
    const key = String(entry.key ?? entry.id ?? `task_${i + 1}`).trim();
    const dependsOn = Array.isArray(entry.depends_on)
      ? entry.depends_on.map((v) => String(v))
      : Array.isArray(entry.dependencies)
      ? entry.dependencies.map((v) => String(v))
      : [];
    for (const dep of dependsOn) {
      if (!knownKeys.has(dep)) {
        errors.push(`Task "${key}": depends_on references unknown key "${dep}".`);
      }
      if (dep === key) {
        errors.push(`Task "${key}": depends_on references itself.`);
      }
    }
  }

  // Check for circular dependencies
  const circularErrors = detectCircularDependencies(blueprints);
  errors.push(...circularErrors);

  // Validate agent_ids reference known agents
  const validAgentIds = new Set(AGENTS.map((a) => a.id));
  for (const b of blueprints) {
    if (!validAgentIds.has(b.agent_id)) {
      errors.push(`Task "${b.key}": agent_id "${b.agent_id}" is not a known agent.`);
    }
    if (b.review_enabled && b.review_agent_id && !validAgentIds.has(b.review_agent_id)) {
      errors.push(`Task "${b.key}": review_agent_id "${b.review_agent_id}" is not a known agent.`);
    }
  }

  return { valid: errors.length === 0, errors, blueprints };
}

export function buildMissionPlanTemplate(mission: Mission): string {
  const fallbackInstructions = mission.mission_statement || mission.input_text || mission.description || 'Define execution instructions.';
  return JSON.stringify({
    missions: [
      {
        key: 'task_1',
        title: mission.title,
        instructions: fallbackInstructions,
        agent_id: mission.agent_id,
        priority: mission.priority,
        due_offset_minutes: 0,
        depends_on: [],
        domains: mission.domains || [],
        review_enabled: mission.review_enabled,
        review_agent_id: mission.review_agent_id,
        max_revisions: mission.max_revisions,
      },
    ],
  }, null, 2);
}
