import type {
  AgentLevel,
  PermissionAction,
  PermissionResult,
  PermissionCheck,
  AgentGuardrails,
  LevelMetricsSnapshot,
} from '../types/supabase';

// ─── Permission Matrix ──────────────────────────────────────────────────────
// Encodes the table from design doc section 2.1

const PERMISSION_MATRIX: Record<AgentLevel, Record<PermissionAction, PermissionResult>> = {
  1: {
    'mission:create': 'deny',
    'mission:execute': 'deny',
    'mission:approve_statement': 'deny',
    'mission:approve_plan': 'deny',
    'mission:assign': 'deny',
    'task:execute': 'approval_required',
    'task:create_subtask': 'deny',
    'task:complete': 'deny',
    'task:reassign': 'deny',
    'comms:send_message': 'deny',
    'comms:delegate': 'deny',
    'comms:broadcast': 'deny',
    'context:read': 'allow',
    'context:write': 'deny',
    'context:delete': 'deny',
    'autonomous:act': 'deny',
    'autonomous:self_schedule': 'deny',
    'autonomous:override_lower': 'deny',
  },
  2: {
    'mission:create': 'draft',
    'mission:execute': 'approval_required',
    'mission:approve_statement': 'deny',
    'mission:approve_plan': 'deny',
    'mission:assign': 'deny',
    'task:execute': 'approval_required',
    'task:create_subtask': 'draft',
    'task:complete': 'deny',
    'task:reassign': 'deny',
    'comms:send_message': 'approval_required',
    'comms:delegate': 'deny',
    'comms:broadcast': 'deny',
    'context:read': 'allow',
    'context:write': 'deny',
    'context:delete': 'deny',
    'autonomous:act': 'deny',
    'autonomous:self_schedule': 'deny',
    'autonomous:override_lower': 'deny',
  },
  3: {
    'mission:create': 'allow',
    'mission:execute': 'allow',
    'mission:approve_statement': 'deny',
    'mission:approve_plan': 'deny',
    'mission:assign': 'deny',
    'task:execute': 'allow',
    'task:create_subtask': 'allow',
    'task:complete': 'allow',
    'task:reassign': 'deny',
    'comms:send_message': 'allow',
    'comms:delegate': 'deny',
    'comms:broadcast': 'allow',
    'context:read': 'allow',
    'context:write': 'allow',
    'context:delete': 'deny',
    'autonomous:act': 'allow',
    'autonomous:self_schedule': 'deny',
    'autonomous:override_lower': 'deny',
  },
  4: {
    'mission:create': 'allow',
    'mission:execute': 'allow',
    'mission:approve_statement': 'allow',
    'mission:approve_plan': 'allow',
    'mission:assign': 'allow',
    'task:execute': 'allow',
    'task:create_subtask': 'allow',
    'task:complete': 'allow',
    'task:reassign': 'allow',
    'comms:send_message': 'allow',
    'comms:delegate': 'allow',
    'comms:broadcast': 'allow',
    'context:read': 'allow',
    'context:write': 'allow',
    'context:delete': 'allow',
    'autonomous:act': 'allow',
    'autonomous:self_schedule': 'allow',
    'autonomous:override_lower': 'allow',
  },
};

// ─── Approval gate mapping by level ─────────────────────────────────────────

function getApprovalGate(level: AgentLevel): PermissionCheck['approval_gate'] {
  if (level <= 2) return 'human_required';
  if (level === 3) return 'guardrail_check';
  return 'self_approved';
}

// ─── Core permission check ──────────────────────────────────────────────────

export interface PermissionContext {
  taskId?: string;
  domains?: string[];
  targetAgentLevel?: AgentLevel;
}

export function checkPermission(
  _agentId: string,
  level: AgentLevel,
  action: PermissionAction,
  guardrails: AgentGuardrails,
  context?: PermissionContext,
): PermissionCheck {
  // 1. Check level permission matrix
  const matrixResult = PERMISSION_MATRIX[level]?.[action];
  if (matrixResult === 'deny') {
    return {
      action,
      result: 'deny',
      reason: `Level ${level} does not permit "${action}"`,
      approval_gate: getApprovalGate(level),
    };
  }

  // 2. Check per-agent denied_actions
  if (guardrails.denied_actions.length > 0 && guardrails.denied_actions.includes(action)) {
    return {
      action,
      result: 'deny',
      reason: `Action "${action}" is explicitly denied for this agent`,
      approval_gate: getApprovalGate(level),
    };
  }

  // 3. Check per-agent allowed_domains (for L3 guardrail checks)
  if (
    level === 3 &&
    guardrails.allowed_domains.length > 0 &&
    !guardrails.allowed_domains.includes('*')
  ) {
    const taskDomains = context?.domains || [];
    const outsideDomains = taskDomains.filter(
      (d) => !guardrails.allowed_domains.includes(d),
    );
    if (outsideDomains.length > 0) {
      return {
        action,
        result: 'approval_required',
        reason: `Domain(s) outside guardrails: ${outsideDomains.join(', ')}`,
        approval_gate: 'guardrail_check',
      };
    }
  }

  // 4. If matrix says approval_required or draft, return that
  if (matrixResult === 'approval_required' || matrixResult === 'draft') {
    return {
      action,
      result: matrixResult,
      reason:
        matrixResult === 'approval_required'
          ? `Level ${level} requires approval for "${action}"`
          : `Level ${level} can only draft "${action}"`,
      approval_gate: getApprovalGate(level),
    };
  }

  // 5. All checks pass
  return {
    action,
    result: 'allow',
    approval_gate: getApprovalGate(level),
  };
}

// ─── Level-up evaluation ────────────────────────────────────────────────────

export interface LevelUpEvaluation {
  eligible: boolean;
  reason: string;
  unmetCriteria: string[];
}

// Import the criteria constant value directly
import { DEFAULT_LEVEL_UP_CRITERIA as CRITERIA } from '../types/supabase';

export function evaluateLevelUp(
  _agentId: string,
  metrics: LevelMetricsSnapshot,
  currentLevel: AgentLevel,
): LevelUpEvaluation {
  if (currentLevel === 4) {
    return { eligible: false, reason: 'Already at maximum level', unmetCriteria: [] };
  }

  const criteria = CRITERIA[currentLevel];
  if (!criteria) {
    return { eligible: false, reason: 'No promotion criteria defined', unmetCriteria: [] };
  }

  const unmet: string[] = [];

  if (metrics.tasks_completed < criteria.min_tasks_completed) {
    unmet.push(
      `Tasks completed: ${metrics.tasks_completed}/${criteria.min_tasks_completed}`,
    );
  }
  if (metrics.avg_review_score < criteria.min_avg_review_score) {
    unmet.push(
      `Avg review score: ${metrics.avg_review_score.toFixed(2)}/${criteria.min_avg_review_score}`,
    );
  }
  if (metrics.time_in_level_days < criteria.min_time_in_level_days) {
    unmet.push(
      `Time in level: ${metrics.time_in_level_days}/${criteria.min_time_in_level_days} days`,
    );
  }
  if (metrics.critical_violations_7d > criteria.max_critical_violations_30d) {
    unmet.push(
      `Critical violations (30d): ${metrics.critical_violations_7d} (max ${criteria.max_critical_violations_30d})`,
    );
  }
  if (metrics.violations_30d > criteria.max_warning_violations_30d) {
    unmet.push(
      `Warning violations (30d): ${metrics.violations_30d} (max ${criteria.max_warning_violations_30d})`,
    );
  }

  if (unmet.length > 0) {
    return {
      eligible: false,
      reason: `Unmet criteria: ${unmet.join('; ')}`,
      unmetCriteria: unmet,
    };
  }

  return {
    eligible: true,
    reason: `All criteria met for promotion from L${currentLevel} to L${currentLevel + 1}`,
    unmetCriteria: [],
  };
}

// ─── Level-down evaluation ──────────────────────────────────────────────────

export interface LevelDownEvaluation {
  shouldDemote: boolean;
  reason: string;
  targetLevel?: AgentLevel;
}

export function evaluateLevelDown(
  _agentId: string,
  metrics: LevelMetricsSnapshot,
  currentLevel: AgentLevel,
): LevelDownEvaluation {
  if (currentLevel === 1) {
    return { shouldDemote: false, reason: 'Already at minimum level' };
  }

  // 3+ critical guardrail violations in 7 days
  if (metrics.critical_violations_7d >= 3) {
    return {
      shouldDemote: true,
      reason: `${metrics.critical_violations_7d} critical violations in 7 days (threshold: 3)`,
      targetLevel: Math.max(1, currentLevel - 1) as AgentLevel,
    };
  }

  // Average review score drops below 0.5 (rolling 10 tasks)
  if (metrics.avg_review_score < 0.5 && metrics.tasks_completed >= 10) {
    return {
      shouldDemote: true,
      reason: `Average review score ${metrics.avg_review_score.toFixed(2)} below 0.5 threshold`,
      targetLevel: Math.max(1, currentLevel - 1) as AgentLevel,
    };
  }

  // 5+ consecutive task failures
  if (metrics.consecutive_failures >= 5) {
    return {
      shouldDemote: true,
      reason: `${metrics.consecutive_failures} consecutive task failures (threshold: 5)`,
      targetLevel: Math.max(1, currentLevel - 1) as AgentLevel,
    };
  }

  // Inactivity > 30 days -> drop to L1
  if (metrics.time_in_level_days > 30 && metrics.tasks_completed === 0) {
    return {
      shouldDemote: true,
      reason: 'Inactive for 30+ days with no tasks completed',
      targetLevel: 1,
    };
  }

  return { shouldDemote: false, reason: 'No demotion triggers met' };
}

// ─── Full matrix accessor ───────────────────────────────────────────────────

export function getPermissionMatrix(): Record<AgentLevel, Record<PermissionAction, PermissionResult>> {
  return PERMISSION_MATRIX;
}
