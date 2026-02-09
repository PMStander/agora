# Agent Leveling Framework - Design Document

## Overview

The Agent Leveling Framework introduces a 4-tier trust/autonomy system for Agora's 10 agents. Each agent starts at Level 1 (Observer) and can progress to Level 4 (Autonomous) based on demonstrated competence, accumulated metrics, and human review. The system enforces permission boundaries at every action point: mission creation, task execution, inter-agent communication, and shared-context writes.

---

## 1. Level Definitions

| Level | Name       | Description |
|-------|-----------|-------------|
| L1    | Observer   | New agents. Can research and produce outputs but ALL actions require human approval. Cannot create tasks/missions. Cannot communicate with other agents autonomously. |
| L2    | Advisor    | Can produce work, recommend actions, draft missions. Executes on human approval. Can read shared context but cannot write. Can request inter-agent help with approval. |
| L3    | Operator   | Autonomous execution within defined guardrails. Creates sub-tasks as needed. Updates shared context. Daily progress reports. Initiates inter-agent communication. Flagged for review if acting outside guardrails. |
| L4    | Autonomous | Full authority over permissioned domains. Creates and assigns missions to lower-level agents. Manages shared context. Self-monitors with periodic check-ins. Only flagged for exceptional situations. |

---

## 2. Permission Matrix

### 2.1 Action Permissions by Level

| Action                              | L1 Observer | L2 Advisor | L3 Operator | L4 Autonomous |
|-------------------------------------|-------------|-----------|-------------|---------------|
| **Missions**                        |             |           |             |               |
| Create mission                      | DENY        | DRAFT (needs approval) | ALLOW (within guardrails) | ALLOW |
| Execute mission                     | DENY        | ALLOW (on approval) | ALLOW | ALLOW |
| Approve mission statement           | DENY        | DENY      | DENY        | ALLOW (own domain only) |
| Approve mission plan                | DENY        | DENY      | DENY        | ALLOW (own domain only) |
| Assign mission to other agents      | DENY        | DENY      | DENY        | ALLOW (to <= L3 agents) |
| **Tasks**                           |             |           |             |               |
| Execute assigned tasks              | ALLOW (output needs approval) | ALLOW (output needs approval) | ALLOW | ALLOW |
| Create sub-tasks                    | DENY        | DRAFT (needs approval) | ALLOW (within mission scope) | ALLOW |
| Complete/close tasks                | DENY        | DENY      | ALLOW       | ALLOW |
| Reassign tasks                      | DENY        | DENY      | DENY        | ALLOW |
| **Inter-Agent Communication**       |             |           |             |               |
| Send message to other agent         | DENY        | REQUEST (needs approval) | ALLOW | ALLOW |
| Delegate work to other agent        | DENY        | DENY      | DENY        | ALLOW |
| Broadcast to team                   | DENY        | DENY      | ALLOW (own team) | ALLOW |
| **Shared Context**                  |             |           |             |               |
| Read shared context                 | ALLOW       | ALLOW     | ALLOW       | ALLOW |
| Write shared context                | DENY        | DENY      | ALLOW (own domain) | ALLOW |
| Delete/overwrite shared context     | DENY        | DENY      | DENY        | ALLOW (own domain) |
| **Autonomous Actions**              |             |           |             |               |
| Act without human approval          | DENY        | DENY      | ALLOW (within guardrails) | ALLOW |
| Self-schedule follow-up missions    | DENY        | DENY      | DENY        | ALLOW |
| Override lower-level agent decisions| DENY        | DENY      | DENY        | ALLOW |

### 2.2 Approval Gate Types

| Gate Type        | Applies To | Description |
|------------------|-----------|-------------|
| `human_required` | L1, L2    | Action is queued until a human explicitly approves or rejects. |
| `guardrail_check`| L3        | Action is auto-approved if it passes domain/scope guardrails; otherwise flagged. |
| `self_approved`  | L4        | Action is auto-approved. Periodic audit check-ins only. |

---

## 3. Guardrails System

### 3.1 Guardrail Types

**Per-Level Guardrails** (defined globally, apply to all agents at that level):
- Action whitelist/blacklist per level (the permission matrix above)
- Maximum concurrent missions per level
- Maximum tasks an agent can create per day
- Required approval gates

**Per-Agent Guardrails** (defined per agent, scoped to their role):
- `allowed_domains`: Domains the agent is permitted to act in (e.g., Hippocrates can only act in `['fitness', 'health', 'nutrition']`)
- `allowed_actions`: Subset of level permissions that are explicitly enabled for this agent
- `denied_actions`: Actions explicitly denied even if the level would allow them
- `max_concurrent_missions`: Override for the level default
- `max_daily_tasks`: Override for the level default
- `escalation_agent_id`: Which agent to escalate to when guardrails are hit
- `auto_review_threshold`: Confidence score below which output is auto-flagged for review

### 3.2 Guardrail Violation Detection

When an agent attempts an action, the system runs through this evaluation chain:

```
1. Check level permission matrix -> DENY = hard block
2. Check per-agent denied_actions -> match = hard block
3. Check per-agent allowed_domains -> domain mismatch = soft block (flagged)
4. Check per-agent allowed_actions -> not in list = soft block (flagged)
5. Check rate limits (max_concurrent, max_daily) -> exceeded = queued
6. All checks pass -> action proceeds
```

**Hard block**: Action is denied. Activity log entry created. Violation counter incremented.

**Soft block**: Action is paused and escalated. The escalation_agent_id (or human) is notified. Action can be approved or denied.

**Queued**: Action is deferred until capacity is available.

### 3.3 Violation Tracking

Each violation is recorded with:
- `agent_id`, `timestamp`, `action_attempted`, `guardrail_violated`
- `severity`: `info` | `warning` | `critical`
- `resolution`: `auto_denied` | `escalated` | `human_overridden`

Violation counts feed into level transition logic (see section 4).

---

## 4. Level Transition Logic

### 4.1 Level-Up Criteria

Promotion requires ALL criteria to be met:

| From -> To | Tasks Completed | Avg Review Score | Time-in-Level | Violations (last 30d) | Human Approval |
|------------|----------------|-----------------|---------------|----------------------|----------------|
| L1 -> L2   | >= 10          | >= 0.7          | >= 7 days     | 0 critical           | Required       |
| L2 -> L3   | >= 25          | >= 0.8          | >= 14 days    | 0 critical, <= 2 warning | Required  |
| L3 -> L4   | >= 50          | >= 0.9          | >= 30 days    | 0 in last 30 days    | Required       |

### 4.2 Level-Down Criteria

Demotion is triggered if ANY criterion is met:

| Trigger                                | Result        |
|----------------------------------------|---------------|
| 3+ critical guardrail violations in 7d | Drop 1 level  |
| Average review score drops below 0.5 (rolling 10 tasks) | Drop 1 level |
| Human override (manual demotion)       | Drop to specified level |
| 5+ consecutive task failures           | Drop 1 level  |
| Inactivity > 30 days                   | Drop to L1    |

### 4.3 Transition Approval Workflow

1. System detects an agent meets level-up criteria.
2. A `level_transition_request` activity is created.
3. For all transitions: human must approve (shown in UI as a notification).
4. On approval: agent level is updated, `level_history` entry is created.
5. On rejection: request is dismissed, cooldown period of 7 days before re-evaluation.

Level-down transitions triggered by violations are **auto-applied** (no approval needed) but generate a prominent notification.

### 4.4 Level History

Every transition is stored as a `LevelHistoryEntry`:
```
{
  agent_id, from_level, to_level,
  trigger: 'promotion' | 'demotion' | 'manual_override',
  reason: string,
  approved_by: 'system' | 'human',
  metrics_snapshot: { tasks_completed, avg_score, violations_30d },
  created_at
}
```

---

## 5. TypeScript Interfaces

All new types will be added to `src/types/supabase.ts`.

```typescript
// ---- Agent Leveling Framework ----

export type AgentLevel = 1 | 2 | 3 | 4;
export type AgentLevelName = 'observer' | 'advisor' | 'operator' | 'autonomous';

export const AGENT_LEVEL_NAMES: Record<AgentLevel, AgentLevelName> = {
  1: 'observer',
  2: 'advisor',
  3: 'operator',
  4: 'autonomous',
};

export const AGENT_LEVEL_LABELS: Record<AgentLevel, string> = {
  1: 'Observer',
  2: 'Advisor',
  3: 'Operator',
  4: 'Autonomous',
};

export const AGENT_LEVEL_COLORS: Record<AgentLevel, string> = {
  1: 'zinc',     // grey/neutral
  2: 'blue',     // trust building
  3: 'amber',    // active operator
  4: 'emerald',  // full autonomy
};

// ---- Permission Types ----

export type PermissionAction =
  | 'mission:create'
  | 'mission:execute'
  | 'mission:approve_statement'
  | 'mission:approve_plan'
  | 'mission:assign'
  | 'task:execute'
  | 'task:create_subtask'
  | 'task:complete'
  | 'task:reassign'
  | 'comms:send_message'
  | 'comms:delegate'
  | 'comms:broadcast'
  | 'context:read'
  | 'context:write'
  | 'context:delete'
  | 'autonomous:act'
  | 'autonomous:self_schedule'
  | 'autonomous:override_lower';

export type PermissionResult = 'allow' | 'deny' | 'approval_required' | 'draft';

export interface PermissionCheck {
  action: PermissionAction;
  result: PermissionResult;
  reason?: string;
  approval_gate?: 'human_required' | 'guardrail_check' | 'self_approved';
}

// ---- Guardrails ----

export type GuardrailViolationSeverity = 'info' | 'warning' | 'critical';
export type GuardrailResolution = 'auto_denied' | 'escalated' | 'human_overridden' | 'approved';

export interface AgentGuardrails {
  allowed_domains: string[];
  allowed_actions: PermissionAction[];
  denied_actions: PermissionAction[];
  max_concurrent_missions: number;
  max_daily_tasks: number;
  escalation_agent_id: string | null;
  auto_review_threshold: number; // 0.0 - 1.0
}

export interface GuardrailViolation {
  id: string;
  agent_id: string;
  action_attempted: PermissionAction;
  guardrail_violated: string;
  severity: GuardrailViolationSeverity;
  resolution: GuardrailResolution;
  context: Record<string, unknown>;
  created_at: string;
}

// ---- Level Transitions ----

export type LevelTransitionTrigger = 'promotion' | 'demotion' | 'manual_override';

export interface LevelMetricsSnapshot {
  tasks_completed: number;
  avg_review_score: number;
  violations_30d: number;
  critical_violations_7d: number;
  consecutive_failures: number;
  time_in_level_days: number;
}

export interface LevelTransitionRequest {
  id: string;
  agent_id: string;
  from_level: AgentLevel;
  to_level: AgentLevel;
  trigger: LevelTransitionTrigger;
  reason: string;
  metrics_snapshot: LevelMetricsSnapshot;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null; // 'system' | 'human'
  reviewed_at: string | null;
  cooldown_until: string | null;
  created_at: string;
}

export interface LevelHistoryEntry {
  id: string;
  agent_id: string;
  from_level: AgentLevel;
  to_level: AgentLevel;
  trigger: LevelTransitionTrigger;
  reason: string;
  approved_by: 'system' | 'human';
  metrics_snapshot: LevelMetricsSnapshot;
  created_at: string;
}

// ---- Agent Level State ----

export interface AgentLevelState {
  agent_id: string;
  current_level: AgentLevel;
  guardrails: AgentGuardrails;
  level_history: LevelHistoryEntry[];
  metrics: LevelMetricsSnapshot;
  pending_transition: LevelTransitionRequest | null;
  level_assigned_at: string; // when current level was assigned
  created_at: string;
  updated_at: string;
}

// ---- Promotion Thresholds (configurable) ----

export interface LevelUpCriteria {
  min_tasks_completed: number;
  min_avg_review_score: number;
  min_time_in_level_days: number;
  max_critical_violations_30d: number;
  max_warning_violations_30d: number;
  requires_human_approval: boolean;
}

export const DEFAULT_LEVEL_UP_CRITERIA: Record<AgentLevel, LevelUpCriteria | null> = {
  1: { // L1 -> L2
    min_tasks_completed: 10,
    min_avg_review_score: 0.7,
    min_time_in_level_days: 7,
    max_critical_violations_30d: 0,
    max_warning_violations_30d: 5,
    requires_human_approval: true,
  },
  2: { // L2 -> L3
    min_tasks_completed: 25,
    min_avg_review_score: 0.8,
    min_time_in_level_days: 14,
    max_critical_violations_30d: 0,
    max_warning_violations_30d: 2,
    requires_human_approval: true,
  },
  3: { // L3 -> L4
    min_tasks_completed: 50,
    min_avg_review_score: 0.9,
    min_time_in_level_days: 30,
    max_critical_violations_30d: 0,
    max_warning_violations_30d: 0,
    requires_human_approval: true,
  },
  4: null, // Already max level
};
```

---

## 6. Database Migration SQL

File: `supabase/migrations/003_agent_leveling.sql`

```sql
-- ============================================================================
-- Agent Leveling Framework
-- ============================================================================

-- Agent level state table
CREATE TABLE IF NOT EXISTS agent_levels (
  agent_id TEXT PRIMARY KEY,
  current_level SMALLINT NOT NULL DEFAULT 1
    CHECK (current_level BETWEEN 1 AND 4),
  guardrails JSONB NOT NULL DEFAULT '{
    "allowed_domains": [],
    "allowed_actions": [],
    "denied_actions": [],
    "max_concurrent_missions": 1,
    "max_daily_tasks": 5,
    "escalation_agent_id": null,
    "auto_review_threshold": 0.7
  }'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{
    "tasks_completed": 0,
    "avg_review_score": 0,
    "violations_30d": 0,
    "critical_violations_7d": 0,
    "consecutive_failures": 0,
    "time_in_level_days": 0
  }'::jsonb,
  level_assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Level history table
CREATE TABLE IF NOT EXISTS agent_level_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  from_level SMALLINT NOT NULL CHECK (from_level BETWEEN 1 AND 4),
  to_level SMALLINT NOT NULL CHECK (to_level BETWEEN 1 AND 4),
  trigger TEXT NOT NULL CHECK (trigger IN ('promotion', 'demotion', 'manual_override')),
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL CHECK (approved_by IN ('system', 'human')),
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_level_history_agent
  ON agent_level_history(agent_id, created_at DESC);

-- Level transition requests (pending approvals)
CREATE TABLE IF NOT EXISTS agent_level_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  from_level SMALLINT NOT NULL CHECK (from_level BETWEEN 1 AND 4),
  to_level SMALLINT NOT NULL CHECK (to_level BETWEEN 1 AND 4),
  trigger TEXT NOT NULL CHECK (trigger IN ('promotion', 'demotion', 'manual_override')),
  reason TEXT NOT NULL,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_level_transitions_agent
  ON agent_level_transitions(agent_id, status);

-- Guardrail violations log
CREATE TABLE IF NOT EXISTS guardrail_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  action_attempted TEXT NOT NULL,
  guardrail_violated TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  resolution TEXT NOT NULL DEFAULT 'auto_denied'
    CHECK (resolution IN ('auto_denied', 'escalated', 'human_overridden', 'approved')),
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_violations_agent
  ON guardrail_violations(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_violations_severity
  ON guardrail_violations(severity, created_at DESC);

-- RLS
ALTER TABLE agent_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_level_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_level_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_violations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_levels' AND policyname = 'Allow all on agent_levels') THEN CREATE POLICY "Allow all on agent_levels" ON agent_levels FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_level_history' AND policyname = 'Allow all on agent_level_history') THEN CREATE POLICY "Allow all on agent_level_history" ON agent_level_history FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_level_transitions' AND policyname = 'Allow all on agent_level_transitions') THEN CREATE POLICY "Allow all on agent_level_transitions" ON agent_level_transitions FOR ALL USING (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guardrail_violations' AND policyname = 'Allow all on guardrail_violations') THEN CREATE POLICY "Allow all on guardrail_violations" ON guardrail_violations FOR ALL USING (true); END IF; END $$;

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_levels; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE guardrail_violations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE agent_level_transitions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed all 10 agents at L1 with domain-appropriate guardrails
INSERT INTO agent_levels (agent_id, current_level, guardrails) VALUES
  ('main', 4, '{"allowed_domains": ["*"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 10, "max_daily_tasks": 50, "escalation_agent_id": null, "auto_review_threshold": 0.5}'),
  ('hippocrates', 1, '{"allowed_domains": ["fitness", "health", "nutrition"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('confucius', 1, '{"allowed_domains": ["family", "relationships"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('seneca', 1, '{"allowed_domains": ["personal-finance", "budgeting", "investing"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('archimedes', 1, '{"allowed_domains": ["technology", "gadgets", "coding"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('leonidas', 1, '{"allowed_domains": ["business-strategy", "leadership"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 2, "max_daily_tasks": 10, "escalation_agent_id": "main", "auto_review_threshold": 0.7}'),
  ('odysseus', 1, '{"allowed_domains": ["finance"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('spartacus', 1, '{"allowed_domains": ["hr", "recruitment"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('achilles', 1, '{"allowed_domains": ["tech-infrastructure", "development", "coding"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 2, "max_daily_tasks": 10, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}'),
  ('alexander', 1, '{"allowed_domains": ["marketing", "sales"], "allowed_actions": [], "denied_actions": [], "max_concurrent_missions": 1, "max_daily_tasks": 5, "escalation_agent_id": "leonidas", "auto_review_threshold": 0.7}')
ON CONFLICT (agent_id) DO NOTHING;
```

---

## 7. UI Components

### 7.1 Level Badge (in AgentSidebar)

**Component**: `<LevelBadge level={agent.level} />`

**Location**: Rendered next to each agent name in `AgentSidebar.tsx` `AgentItem` component (line 14-53).

**Visual Design**:
- Small pill badge to the right of the agent name
- Color-coded per level: L1=zinc, L2=blue, L3=amber, L4=emerald
- Shows "L1", "L2", "L3", or "L4"
- Tooltip on hover shows the full level name ("Observer", "Advisor", etc.)

```
[ Avatar ] Agent Name [L2]
           Role description
```

**Implementation approach**: Add a `level` field to the `Agent` interface in `src/stores/agents.ts`. The `AgentItem` component renders the badge inline.

### 7.2 Level Detail Panel (Agent Profile)

**Component**: `<AgentLevelDetail agentId={agent.id} />`

**Location**: New section in the agent profile area (could be a tab in ContextPanel or a modal).

**Contents**:
- Current level with full name and description
- Progress bar toward next level showing:
  - Tasks completed: X / required
  - Average review score: X.XX / required
  - Time in level: X days / required
  - Violations: X / max allowed
- "Request Promotion" button (if criteria met and no pending request)
- "Demote" button (for human override, confirmation required)

### 7.3 Guardrail Configuration Panel

**Component**: `<GuardrailConfig agentId={agent.id} />`

**Location**: Accessible from agent profile or Settings panel.

**Contents**:
- Domain checklist (from `ALL_DOMAINS` in `src/types/supabase.ts`)
- Rate limit sliders (max concurrent missions, max daily tasks)
- Escalation agent dropdown
- Auto-review threshold slider (0.0 - 1.0)
- Denied actions multi-select
- "Save Guardrails" button

### 7.4 Level History Timeline

**Component**: `<LevelTimeline agentId={agent.id} />`

**Location**: Inside agent profile detail panel.

**Visual Design**: Vertical timeline showing:
- Each level change as a node (color-coded)
- Date and trigger (promotion/demotion/manual)
- Reason text
- Metrics snapshot at time of transition
- Who approved (system vs human)

### 7.5 Permission Override Interface

**Component**: `<PermissionOverridePanel />`

**Location**: Accessible from Settings or as a notification-driven modal.

**Contents**:
- List of pending approval requests (from L1/L2 agents)
- Each shows: agent name, action requested, context
- "Approve" / "Deny" buttons per request
- Batch approve/deny for multiple requests
- List of pending level transition requests with "Approve" / "Reject"

### 7.6 Guardrail Violations Feed

**Component**: `<ViolationsFeed />`

**Location**: New section in the Activity Feed area of Mission Control.

**Contents**:
- Chronological list of guardrail violations
- Color-coded by severity (info=blue, warning=amber, critical=red)
- Shows agent, action attempted, and resolution
- Filter by agent, severity, date range

---

## 8. Mission Scheduler Integration

### 8.1 How the Scheduler Respects Levels

**File affected**: `src/hooks/useMissionScheduler.ts`

The scheduler's `tick()` function (line 880) and `startPrimaryIfDue()` (line 688) need a permission check before launching any task.

**Integration point in `startPrimaryIfDue`** (after line 691):

```typescript
// NEW: Check agent level permissions before executing
const agentLevel = getAgentLevel(task.primary_agent_id);
const permCheck = checkPermission(task.primary_agent_id, agentLevel, 'task:execute', {
  taskId: task.id,
  domains: task.domains,
});

if (permCheck.result === 'deny') {
  updateTask(task.id, {
    status: 'blocked',
    active_summary: `Agent lacks permission (L${agentLevel}): ${permCheck.reason}`,
    error_message: null,
  });
  logGuardrailViolation(task.primary_agent_id, 'task:execute', permCheck.reason, 'warning');
  return;
}

if (permCheck.result === 'approval_required') {
  updateTask(task.id, {
    status: 'blocked',
    active_summary: `Awaiting human approval (Agent is L${agentLevel})`,
    error_message: null,
  });
  createApprovalRequest(task.primary_agent_id, 'task:execute', { taskId: task.id });
  return;
}
```

### 8.2 Approval Gates Based on Agent Level

When the scheduler encounters an L1 or L2 agent's task:

1. **L1 Observer**: Task output is always routed through `review` phase regardless of `review_enabled` flag. The review agent is the agent's `escalation_agent_id` or `main` (Marcus Aurelius). Human must approve the review result.

2. **L2 Advisor**: Task is only launched if the mission was explicitly approved by a human. Draft missions created by L2 agents sit in `awaiting_approval` state. Output goes through normal review flow.

3. **L3 Operator**: Task launches autonomously if within guardrail domains. If the task's domains include any domain not in the agent's `allowed_domains`, execution is paused and escalated.

4. **L4 Autonomous**: No gates. Task launches immediately. Self-monitors via periodic check-in activities.

### 8.3 Escalation Paths

When an L1/L2 agent needs to act but requires approval:

```
L1 agent action -> Queue as "pending_approval"
  -> Show in PermissionOverridePanel
  -> Human approves/denies
  -> If approved: scheduler picks up on next tick
  -> If denied: task marked as blocked with reason

L2 agent draft mission -> Queue as "awaiting_approval"
  -> Show in MissionControlTab notification area
  -> Human approves statement/plan
  -> If approved: normal mission lifecycle continues
  -> If denied: mission cancelled

L3 agent guardrail violation -> Auto-escalate to escalation_agent_id
  -> If escalation agent is L4: auto-approve within their domain
  -> Otherwise: escalate to human
```

### 8.4 Scheduler `tick()` Modifications

The `tick()` function at line 880 should be modified to:

1. Sort tasks by agent level (L4 first, L1 last) so higher-trust agents get execution priority.
2. For L1/L2 tasks: check if there is an approved approval request before launching.
3. For L3 tasks: run domain guardrail check before launching.
4. Update agent metrics after each task completion (increment `tasks_completed`, update `avg_review_score`).

---

## 9. Integration Points Summary

| Existing File | Integration |
|--------------|-------------|
| `src/types/supabase.ts` | Add all new interfaces and type exports (section 5) |
| `src/stores/agents.ts` | Add `level: AgentLevel` to `Agent` interface; add `agentLevels` state |
| `src/stores/missionControl.ts` | Add `agentLevels: Record<string, AgentLevelState>`, `violations: GuardrailViolation[]`, `pendingApprovals: LevelTransitionRequest[]` |
| `src/hooks/useMissionScheduler.ts` | Add permission checks in `startPrimaryIfDue()` and `tick()` |
| `src/hooks/useMissionControl.ts` | Add `createMission` guardrail check (L1 cannot create, L2 drafts only) |
| `src/components/agents/AgentSidebar.tsx` | Add `<LevelBadge>` to `AgentItem` |
| `src/components/mission-control/MissionControlTab.tsx` | Add pending approvals notification area |
| `src/components/mission-control/ActivityFeed.tsx` | Add violation events rendering |
| `src/components/settings/SettingsPanel.tsx` | Add guardrail configuration section |
| `supabase/schema.sql` | Add migration (section 6) |

---

## 10. New Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useAgentLevel.ts` | Hook: get/set agent level, check permissions, evaluate transitions |
| `src/lib/permissions.ts` | Pure functions: `checkPermission()`, `evaluateLevelUp()`, `evaluateLevelDown()` |
| `src/components/agents/LevelBadge.tsx` | UI: colored pill badge for agent level |
| `src/components/agents/AgentLevelDetail.tsx` | UI: level detail panel with progress bars |
| `src/components/agents/GuardrailConfig.tsx` | UI: guardrail configuration form |
| `src/components/agents/LevelTimeline.tsx` | UI: level history timeline visualization |
| `src/components/agents/PermissionOverridePanel.tsx` | UI: approve/deny pending requests |
| `supabase/migrations/003_agent_leveling.sql` | DB migration |

---

## 11. Default Agent Levels

On initial setup, agents are seeded as follows:

| Agent | Level | Rationale |
|-------|-------|-----------|
| Marcus Aurelius (main) | L4 | Orchestrator needs full authority |
| All other agents | L1 | Start as observers, earn trust through work |

Marcus Aurelius starts at L4 because he is the main orchestrator and must be able to assign missions, manage context, and coordinate all other agents. All other agents start at L1 and progress through demonstrated competence.
