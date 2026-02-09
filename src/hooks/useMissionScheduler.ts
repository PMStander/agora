import { useCallback, useEffect, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { canStartTask, getIncompleteDependencyTitles, isRootMissionPlaceholder } from '../lib/taskDependencies';
import { checkPermission } from '../lib/permissions';
import { useMissionControlStore } from '../stores/missionControl';
import { AGENTS, type Mission, type MissionStatus, type ReviewAction, type ReviewHistoryEntry, type Task, type AgentLevel, type AgentGuardrails } from '../types/supabase';
import { generateProofReport, appendProofToOutput } from '../lib/proofGenerator';

type RunPhase = 'primary' | 'review';

interface ActiveRun {
  runId: string;
  taskId: string;
  agentId: string;
  phase: RunPhase;
  buffer: string;
}

interface ReviewDecision {
  action: ReviewAction;
  summary: string;
  confidenceScore: number;
  specificIssues: string[];
  newInstructions: string | null;
  reassignAgentId: string | null;
}

const CHECK_INTERVAL_MS = 60_000;
const THINKING_BUFFER_LIMIT = 8000;
const MAX_ACTIVE_RUNS = 1;
const STALE_RUN_GRACE_MS = 120_000;
const CONNECTION_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

function extractText(message: unknown): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null) {
    const obj = message as Record<string, unknown>;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.text === 'string') return obj.text;
    if (Array.isArray(obj.content)) {
      return obj.content
        .map((chunk) => {
          if (!chunk || typeof chunk !== 'object') return '';
          const contentChunk = chunk as Record<string, unknown>;
          return contentChunk.type === 'text' && typeof contentChunk.text === 'string'
            ? contentChunk.text
            : '';
        })
        .join('');
    }
  }
  return '';
}

function agentDisplay(agentId: string): { id: string; name: string; emoji: string } {
  const agent = AGENTS.find((entry) => entry.id === agentId);
  return agent
    ? { id: agent.id, name: agent.name, emoji: agent.emoji }
    : { id: agentId, name: agentId, emoji: '🤖' };
}

// ─── Agent level helpers (reads from Supabase cache or defaults) ─────────
// This is a synchronous lookup used by the scheduler. The useAgentLevel hook
// keeps the realtime state; here we fetch once and cache in-memory.

const agentLevelCache = new Map<string, { level: AgentLevel; guardrails: AgentGuardrails }>();

const DEFAULT_GUARDRAILS: AgentGuardrails = {
  allowed_domains: [],
  allowed_actions: [],
  denied_actions: [],
  max_concurrent_missions: 1,
  max_daily_tasks: 5,
  escalation_agent_id: null,
  auto_review_threshold: 0.7,
};

function getCachedAgentLevel(agentId: string): { level: AgentLevel; guardrails: AgentGuardrails } {
  return agentLevelCache.get(agentId) || { level: 1 as AgentLevel, guardrails: DEFAULT_GUARDRAILS };
}

async function refreshAgentLevelCache(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { data } = await supabase.from('agent_levels').select('agent_id, current_level, guardrails');
  if (data) {
    for (const row of data) {
      agentLevelCache.set(row.agent_id, {
        level: row.current_level as AgentLevel,
        guardrails: (row.guardrails as AgentGuardrails) || DEFAULT_GUARDRAILS,
      });
    }
  }
}

function trimThinking(text: string): string {
  if (text.length <= THINKING_BUFFER_LIMIT) return text;
  return text.slice(text.length - THINKING_BUFFER_LIMIT);
}

function parseTimeOrFallback(value: string | null | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

function isMissionLifecycleReady(mission: Mission): boolean {
  const phase = mission.mission_phase || 'tasks';
  const phaseStatus = mission.mission_phase_status || 'approved';
  return phase === 'tasks' && phaseStatus === 'approved';
}

function aggregateMissionStatus(tasks: Task[]): MissionStatus {
  if (tasks.length === 0) return 'scheduled';

  const allTerminal = tasks.every((t) => t.status === 'done' || t.status === 'failed');
  if (allTerminal) {
    // All done -> mission done; any failures among terminal tasks -> mission failed
    return tasks.every((t) => t.status === 'done') ? 'done' : 'failed';
  }

  // Non-terminal tasks still exist - continue tracking progress
  if (tasks.some((task) => task.status === 'review')) return 'pending_review';
  if (tasks.some((task) => task.status === 'in_progress')) return 'in_progress';

  const hasRevision = tasks.some((task) => task.revision_round > 0);
  return hasRevision ? 'revision' : 'assigned';
}

function resolveAction(parsed: Record<string, unknown>): ReviewAction {
  const action = typeof parsed.action === 'string' ? parsed.action.toLowerCase() : '';
  if (action === 'approve' || action === 'revise' || action === 'redo') return action;
  if (parsed.approved === true) return 'approve';
  return 'revise';
}

function parseReviewDecision(rawText: string): ReviewDecision {
  const fallbackRevise: ReviewDecision = {
    action: 'revise',
    summary: 'Reviewer requested changes.',
    confidenceScore: 0,
    specificIssues: [],
    newInstructions: rawText.trim() || 'Please revise based on reviewer feedback.',
    reassignAgentId: null,
  };

  const text = rawText.trim();
  const jsonCandidates: string[] = [];
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) jsonCandidates.push(fenced[1]);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) jsonCandidates.push(objectMatch[0]);

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const action = resolveAction(parsed);
      const summary = typeof parsed.summary === 'string'
        ? parsed.summary
        : action === 'approve'
        ? 'Review approved.'
        : 'Reviewer requested changes.';
      const confidenceScore = typeof parsed.confidence_score === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence_score))
        : 0;
      const specificIssues = Array.isArray(parsed.specific_issues)
        ? parsed.specific_issues.filter((item): item is string => typeof item === 'string')
        : [];
      const newInstructions = typeof parsed.new_instructions === 'string'
        ? parsed.new_instructions
        : typeof parsed.follow_up_instructions === 'string'
        ? parsed.follow_up_instructions
        : typeof parsed.followUpInstructions === 'string'
        ? parsed.followUpInstructions
        : null;
      const reassignAgentId = typeof parsed.reassign_agent_id === 'string'
        ? parsed.reassign_agent_id
        : null;
      return {
        action,
        summary,
        confidenceScore,
        specificIssues,
        newInstructions,
        reassignAgentId,
      };
    } catch {
      // Try next parse strategy.
    }
  }

  const lowered = text.toLowerCase();
  if (lowered.includes('approved') || lowered.includes('looks good') || lowered.includes('pass')) {
    return {
      action: 'approve',
      summary: text || 'Review approved.',
      confidenceScore: 0,
      specificIssues: [],
      newInstructions: null,
      reassignAgentId: null,
    };
  }

  if (lowered.includes('redo') || lowered.includes('start over') || lowered.includes('fundamentally wrong')) {
    return {
      action: 'redo',
      summary: text || 'Reviewer requested a complete redo.',
      confidenceScore: 0,
      specificIssues: [],
      newInstructions: text || 'Please redo this task with a new approach.',
      reassignAgentId: null,
    };
  }

  return fallbackRevise;
}

function buildPrimaryPrompt(task: Task): string {
  const mediaSection = task.input_media.length > 0
    ? [
        'Attached media metadata (process if relevant):',
        ...task.input_media.map((media) => `- ${media.name} (${media.type}) ${media.url}`),
      ].join('\n')
    : 'No media attached.';

  return [
    'You are executing a mission.',
    `Mission title: ${task.title}`,
    task.input_text ? `Instructions:\n${task.input_text}` : 'Instructions: none provided.',
    mediaSection,
    '',
    'Return your complete final work as plain text.',
    'Do not ask follow-up questions; make reasonable assumptions and execute.',
  ].join('\n');
}

function buildReviewHistorySection(task: Task): string {
  const history = task.review_history || [];
  if (history.length === 0) return '';
  const entries = history.map((entry) => [
    `  Round ${entry.round}: ${entry.action.toUpperCase()}`,
    `  Summary: ${entry.summary}`,
    entry.specific_issues.length > 0
      ? `  Issues: ${entry.specific_issues.join('; ')}`
      : null,
    entry.new_instructions
      ? `  Instructions given: ${entry.new_instructions}`
      : null,
  ].filter(Boolean).join('\n'));
  return ['## Previous Review History', ...entries].join('\n\n');
}

function buildReviewPrompt(task: Task, primaryOutput: string): string {
  const store = useMissionControlStore.getState();
  const rootId = task.root_task_id || task.id;
  const mission = store.missions.find((entry) => entry.id === rootId);

  const missionStatementSection = mission?.mission_statement
    ? `## Original Mission Statement\n${mission.mission_statement}`
    : '';
  const missionPlanSection = mission?.mission_plan
    ? `## Mission Plan\n${mission.mission_plan}`
    : '';

  const mediaSection = task.input_media.length > 0
    ? [
        '## Attached Media',
        ...task.input_media.map((media) => `- ${media.name} (${media.type}) ${media.url}`),
      ].join('\n')
    : '';

  const reviewHistorySection = buildReviewHistorySection(task);

  const primaryAgent = agentDisplay(task.primary_agent_id);
  const reviewAgent = task.review_agent_id ? agentDisplay(task.review_agent_id) : null;

  return [
    'You are a strict reviewer for an AI mission.',
    '',
    `## Original Mission`,
    `Title: ${task.title}`,
    task.input_text ? `Instructions:\n${task.input_text}` : 'Instructions: none.',
    missionStatementSection,
    missionPlanSection,
    mediaSection,
    '',
    `## Agent Work`,
    `Primary agent: ${primaryAgent.name} (${primaryAgent.id})`,
    reviewAgent ? `Review agent: ${reviewAgent.name} (${reviewAgent.id})` : '',
    task.revision_round > 0 ? `Revision round: ${task.revision_round}` : '',
    '',
    'Agent output to review:',
    primaryOutput || '(no output provided)',
    '',
    reviewHistorySection,
    '',
    '## Review Instructions',
    'Evaluate the agent output against the original instructions.',
    'Review criteria:',
    '- Check completeness, correctness, and instruction adherence.',
    '- Approve only if the work is done and high quality.',
    '- Use REVISE if the approach is sound but needs specific fixes.',
    '- Use REDO if the agent took a fundamentally wrong approach and should start over.',
    '',
    'Respond ONLY as JSON with this shape:',
    '{',
    '  "action": "approve" | "revise" | "redo",',
    '  "summary": "short summary of your assessment",',
    '  "confidence_score": 0.0 to 1.0,',
    '  "specific_issues": ["issue 1", "issue 2"],',
    '  "new_instructions": "required for revise/redo - what should be done differently",',
    '  "reassign_agent_id": "optional - agent id if redo should use a different agent"',
    '}',
  ].filter((line) => line !== '').join('\n');
}

function getTask(taskId: string): Task | undefined {
  return useMissionControlStore.getState().tasks.find((task) => task.id === taskId);
}

function addActivity(type: string, message: string, agentId?: string) {
  const store = useMissionControlStore.getState();
  store.addActivity({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    agent: agentId ? agentDisplay(agentId) : null,
    created_at: new Date().toISOString(),
  });
}

export function useMissionScheduler() {
  const schedulerForceTickVersion = useMissionControlStore((s) => s.schedulerForceTickVersion);
  const activeRunsRef = useRef<Map<string, ActiveRun>>(new Map());
  const runAliasRef = useRef<Map<string, string>>(new Map());
  const initializingRef = useRef(false);
  const tickingRef = useRef(false);
  const missionSyncChainRef = useRef<Map<string, Promise<void>>>(new Map());

  const syncMissionFromTask = useCallback((taskId: string) => {
    const store = useMissionControlStore.getState();
    const task = store.tasks.find((entry) => entry.id === taskId);
    if (!task) return;

    const missionId = task.root_task_id || task.id;
    const mission = store.missions.find((entry) => entry.id === missionId);
    if (!mission) return;

    const missionTasks = store.tasks.filter((entry) => (entry.root_task_id || entry.id) === missionId);
    const executableTasks = missionTasks.filter((entry) => entry.id !== missionId);
    const statusSource = executableTasks.length > 0 ? executableTasks : [task];
    const patch: Partial<Mission> = {};

    if (isMissionLifecycleReady(mission)) {
      const nextStatus = aggregateMissionStatus(statusSource);
      if (mission.status !== nextStatus) patch.status = nextStatus;
      if (mission.mission_status !== nextStatus) patch.mission_status = nextStatus;

      // Log mission completion/failure transitions with progress
      const doneCount = statusSource.filter((t) => t.status === 'done').length;
      const totalCount = statusSource.length;
      if (nextStatus === 'done' && mission.status !== 'done') {
        addActivity('mission_completed', `Mission completed: "${mission.title}" (${doneCount}/${totalCount} tasks done)`);
      } else if (nextStatus === 'failed' && mission.status !== 'failed') {
        const failedCount = statusSource.filter((t) => t.status === 'failed').length;
        addActivity('mission_failed', `Mission failed: "${mission.title}" (${failedCount}/${totalCount} tasks failed, ${doneCount} done)`);
      }
    }

    const startedAtValues = statusSource
      .map((entry) => parseTimeOrFallback(entry.started_at, Number.POSITIVE_INFINITY))
      .filter((value) => Number.isFinite(value));
    const derivedStartedAt = startedAtValues.length > 0
      ? new Date(Math.min(...startedAtValues)).toISOString()
      : null;
    if (mission.started_at !== derivedStartedAt) patch.started_at = derivedStartedAt;

    const allTerminal = statusSource.every((entry) => entry.status === 'done' || entry.status === 'failed');
    const completedAtValues = statusSource
      .map((entry) => parseTimeOrFallback(entry.completed_at, Number.NEGATIVE_INFINITY))
      .filter((value) => Number.isFinite(value));
    const derivedCompletedAt = allTerminal && completedAtValues.length > 0
      ? new Date(Math.max(...completedAtValues)).toISOString()
      : null;
    if (mission.completed_at !== derivedCompletedAt) patch.completed_at = derivedCompletedAt;

    const mostRecentOutput = [...statusSource]
      .filter((entry) => entry.output_text)
      .sort((a, b) => parseTimeOrFallback(b.updated_at, 0) - parseTimeOrFallback(a.updated_at, 0))[0];
    const nextOutput = mostRecentOutput?.output_text || null;
    if (mission.output_text !== nextOutput) patch.output_text = nextOutput;

    const mostRecentReviewNotes = [...statusSource]
      .filter((entry) => entry.review_notes)
      .sort((a, b) => parseTimeOrFallback(b.updated_at, 0) - parseTimeOrFallback(a.updated_at, 0))[0];
    const nextReviewNotes = mostRecentReviewNotes?.review_notes || null;
    if (mission.review_notes !== nextReviewNotes) patch.review_notes = nextReviewNotes;

    const maxRevisionRound = statusSource.reduce((current, entry) => Math.max(current, entry.revision_round), 0);
    if (mission.revision_round !== maxRevisionRound) patch.revision_round = maxRevisionRound;

    const maxRevisions = statusSource.reduce((current, entry) => Math.max(current, entry.max_revisions), 0);
    if (mission.max_revisions !== maxRevisions) patch.max_revisions = maxRevisions;

    const reviewEnabled = statusSource.some((entry) => entry.review_enabled);
    if (mission.review_enabled !== reviewEnabled) patch.review_enabled = reviewEnabled;

    const reviewAgentId = statusSource.find((entry) => entry.review_agent_id)?.review_agent_id || null;
    if (mission.review_agent_id !== reviewAgentId) patch.review_agent_id = reviewAgentId;

    if (task.id === missionId && executableTasks.length === 0 && mission.scheduled_at !== task.due_at) {
      patch.scheduled_at = task.due_at;
    }

    if (Object.keys(patch).length === 0) return;

    const stampedPatch: Partial<Mission> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    store.updateMission(missionId, stampedPatch);

    if (!isSupabaseConfigured()) return;

    const previous = missionSyncChainRef.current.get(missionId) || Promise.resolve();
    const next = previous
      .catch(() => {
        // Keep chain alive even if the previous sync failed.
      })
      .then(async () => {
        const { error } = await supabase
          .from('missions')
          .update(stampedPatch)
          .eq('id', missionId);
        if (error) {
          console.error(`[MissionScheduler] Failed syncing mission ${missionId}:`, error);
        }
      });

    missionSyncChainRef.current.set(missionId, next);
    void next.finally(() => {
      if (missionSyncChainRef.current.get(missionId) === next) {
        missionSyncChainRef.current.delete(missionId);
      }
    });
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    useMissionControlStore.getState().updateTask(taskId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
    syncMissionFromTask(taskId);
  }, [syncMissionFromTask]);

  const claimMissionForExecution = useCallback(async (mission: Mission): Promise<boolean> => {
    if (!isSupabaseConfigured()) return true;

    const remoteStatus = mission.mission_status || mission.status;
    const existingSession = mission.session_key || '';
    if (remoteStatus === 'in_progress') {
      return existingSession.startsWith('frontend:');
    }
    if (existingSession && !existingSession.startsWith('frontend:')) {
      return false;
    }

    const now = new Date().toISOString();
    const sessionKey = existingSession.startsWith('frontend:')
      ? existingSession
      : `frontend:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const claimableStatuses: MissionStatus[] = ['scheduled', 'assigned', 'revision'];
    const { data, error } = await supabase
      .from('missions')
      .update({
        status: 'in_progress',
        mission_status: 'in_progress',
        started_at: mission.started_at || now,
        updated_at: now,
        session_key: sessionKey,
      })
      .eq('id', mission.id)
      .eq('mission_phase', 'tasks')
      .eq('mission_phase_status', 'approved')
      .in('mission_status', claimableStatuses)
      .select()
      .maybeSingle();

    if (error) {
      console.error(`[MissionScheduler] Failed claiming mission ${mission.id}:`, error);
      return false;
    }
    if (!data) return false;

    useMissionControlStore.getState().updateMission(mission.id, data as Mission);
    return true;
  }, []);

  const completeTask = useCallback(async (taskId: string, outputText: string) => {
    const task = getTask(taskId);
    if (!task) return;

    // Generate proof report and append to output
    let finalOutput = outputText;
    try {
      const proofReport = await generateProofReport(task, outputText);
      finalOutput = appendProofToOutput(outputText, proofReport);
    } catch (error) {
      console.error('[MissionScheduler] Failed to generate proof report:', error);
      // Continue without proof rather than failing the task
    }

    updateTask(taskId, {
      status: 'done',
      completed_at: new Date().toISOString(),
      output_text: finalOutput,
      active_phase: null,
      active_run_id: null,
      active_summary: 'Mission completed.',
      active_thinking: null,
      error_message: null,
    });
  }, [updateTask]);

  const failTask = useCallback((taskId: string, error: string) => {
    updateTask(taskId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      active_phase: null,
      active_run_id: null,
      active_summary: 'Mission failed.',
      active_thinking: null,
      error_message: error,
    });
  }, [updateTask]);

  const cleanupRun = useCallback((runId: string) => {
    activeRunsRef.current.delete(runId);
    for (const [alias, id] of runAliasRef.current.entries()) {
      if (id === runId) {
        runAliasRef.current.delete(alias);
      }
    }
  }, []);

  const createRevisionTask = useCallback((parent: Task, instructions: string, reviewHistory: ReviewHistoryEntry[]): Task => {
    const now = new Date().toISOString();
    const nextRound = parent.revision_round + 1;
    const primary = agentDisplay(parent.primary_agent_id);
    const revisionTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      title: `${parent.title} (Revision ${nextRound})`,
      description: instructions,
      status: 'todo',
      priority: parent.priority,
      domains: [...parent.domains],
      assignees: [primary],
      due_at: now,
      started_at: null,
      completed_at: null,
      primary_agent_id: parent.primary_agent_id,
      review_enabled: true,
      review_agent_id: parent.review_agent_id,
      max_revisions: parent.max_revisions,
      revision_round: nextRound,
      parent_task_id: parent.id,
      root_task_id: parent.root_task_id || parent.id,
      input_text: instructions,
      input_media: [],
      output_text: null,
      review_notes: null,
      review_history: reviewHistory,
      dependency_task_ids: [],
      linked_revision_task_id: null,
      active_run_id: null,
      active_phase: null,
      active_thinking: null,
      active_summary: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    const store = useMissionControlStore.getState();
    store.addTask(revisionTask);
    updateTask(parent.id, {
      linked_revision_task_id: revisionTask.id,
      review_notes: 'Reviewer requested changes.',
      active_summary: 'Revision requested by reviewer.',
    });
    addActivity('review_revision_requested', `Reviewer requested revision for: ${parent.title}`, parent.review_agent_id || undefined);
    return revisionTask;
  }, [updateTask]);

  const createRedoTask = useCallback((parent: Task, instructions: string, reviewHistory: ReviewHistoryEntry[], reassignAgentId?: string | null): Task => {
    const now = new Date().toISOString();
    const agentId = reassignAgentId && AGENTS.some((a) => a.id === reassignAgentId)
      ? reassignAgentId
      : parent.primary_agent_id;
    const agent = agentDisplay(agentId);
    const redoTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      title: `${parent.title} (Redo)`,
      description: instructions,
      status: 'todo',
      priority: parent.priority,
      domains: [...parent.domains],
      assignees: [agent],
      due_at: now,
      started_at: null,
      completed_at: null,
      primary_agent_id: agentId,
      review_enabled: true,
      review_agent_id: parent.review_agent_id,
      max_revisions: parent.max_revisions,
      revision_round: 0,
      parent_task_id: parent.id,
      root_task_id: parent.root_task_id || parent.id,
      input_text: instructions,
      input_media: [...parent.input_media],
      output_text: null,
      review_notes: null,
      review_history: reviewHistory,
      dependency_task_ids: [],
      linked_revision_task_id: null,
      active_run_id: null,
      active_phase: null,
      active_thinking: null,
      active_summary: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    const store = useMissionControlStore.getState();
    store.addTask(redoTask);
    updateTask(parent.id, {
      status: 'failed',
      linked_revision_task_id: redoTask.id,
      review_notes: 'Reviewer requested a complete redo.',
      active_summary: 'Redo requested by reviewer.',
      error_message: 'Review agent requested redo: fundamentally wrong approach.',
    });
    const handoffMsg = reassignAgentId && reassignAgentId !== parent.primary_agent_id
      ? `Reviewer requested redo for: ${parent.title} (reassigned from ${agentDisplay(parent.primary_agent_id).name} to ${agent.name})`
      : `Reviewer requested redo for: ${parent.title}`;
    addActivity('review_redo_requested', handoffMsg, parent.review_agent_id || undefined);
    return redoTask;
  }, [updateTask]);

  const launchRun = useCallback(async (taskId: string, phase: RunPhase, overridePrompt?: string) => {
    const task = getTask(taskId);
    if (!task) return;
    const agentId = phase === 'primary' ? task.primary_agent_id : (task.review_agent_id || '');
    if (!agentId) {
      failTask(task.id, 'No review agent configured.');
      addActivity('task_failed', `Task failed (missing review agent): ${task.title}`);
      return;
    }

    const prompt = overridePrompt || (phase === 'primary'
      ? buildPrimaryPrompt(task)
      : buildReviewPrompt(task, task.output_text || ''));

    // Save checkpoint before launching so we can resume after connection drops
    const existingCheckpoint = useMissionControlStore.getState().runCheckpoints[task.id];
    const connectionDrops = existingCheckpoint?.connectionDrops ?? 0;
    useMissionControlStore.getState().saveCheckpoint(task.id, {
      taskId: task.id,
      phase,
      agentId,
      prompt,
      buffer: '',
      timestamp: Date.now(),
      connectionDrops,
    });

    const sessionKey = `agent:${agentId}:mission:${task.id}:${phase}:${task.revision_round}:${Date.now()}`;
    const localRunId = `mission-run-${task.id}-${phase}-${Date.now()}`;

    activeRunsRef.current.set(localRunId, {
      runId: localRunId,
      taskId: task.id,
      agentId,
      phase,
      buffer: '',
    });

    updateTask(task.id, {
      active_phase: phase,
      active_run_id: localRunId,
      active_summary: phase === 'primary' ? `Running ${agentDisplay(agentId).name}...` : `Reviewing with ${agentDisplay(agentId).name}...`,
      active_thinking: '',
      error_message: null,
    });

    try {
      await openclawClient.connect();
      const ack = await openclawClient.send('chat.send', {
        sessionKey,
        message: prompt,
        deliver: false,
        idempotencyKey: localRunId,
      }) as { runId?: string } | undefined;

      const serverRunId = ack?.runId;
      if (serverRunId && serverRunId !== localRunId) {
        runAliasRef.current.set(serverRunId, localRunId);
        updateTask(task.id, { active_run_id: serverRunId });
      }
    } catch (err) {
      cleanupRun(localRunId);
      useMissionControlStore.getState().removeCheckpoint(task.id);
      const message = String(err);
      failTask(task.id, message);
      addActivity('task_failed', `Task failed: ${task.title}`);
    }
  }, [cleanupRun, failTask, updateTask]);

  const startPrimaryIfDue = useCallback(async (taskId: string) => {
    const store = useMissionControlStore.getState();
    const task = store.tasks.find((entry) => entry.id === taskId);
    if (!task || (task.status !== 'todo' && task.status !== 'blocked')) return;
    if (isRootMissionPlaceholder(task, store.tasks)) return;

    const missionId = task.root_task_id || task.id;
    const mission = store.missions.find((entry) => entry.id === missionId);
    if (mission && !isMissionLifecycleReady(mission)) {
      updateTask(task.id, {
        status: 'blocked',
        active_summary: `Waiting for ${mission.mission_phase || 'tasks'} approval`,
        error_message: null,
      });
      return;
    }

    if (mission) {
      const claimed = await claimMissionForExecution(mission);
      if (!claimed) {
        updateTask(task.id, {
          status: 'blocked',
          active_summary: 'Claimed by external dispatcher. Waiting for sync...',
          error_message: null,
        });
        return;
      }
    }

    if (!canStartTask(task, store.tasks)) {
      const unmetDependencies = getIncompleteDependencyTitles(task, store.tasks);
      updateTask(task.id, {
        status: 'blocked',
        active_summary: `Blocked by: ${unmetDependencies.join(', ')}`,
        error_message: null,
      });
      return;
    }

    // ── Agent level permission check ────────────────────────────────
    const { level: agentLevel, guardrails } = getCachedAgentLevel(task.primary_agent_id);
    const permCheck = checkPermission(
      task.primary_agent_id,
      agentLevel,
      'task:execute',
      guardrails,
      { taskId: task.id, domains: task.domains },
    );

    if (permCheck.result === 'deny') {
      updateTask(task.id, {
        status: 'blocked',
        active_summary: `Agent lacks permission (L${agentLevel}): ${permCheck.reason}`,
        error_message: null,
      });
      addActivity('permission_denied', `Permission denied for ${agentDisplay(task.primary_agent_id).name}: ${permCheck.reason}`, task.primary_agent_id);
      return;
    }

    if (permCheck.result === 'approval_required') {
      updateTask(task.id, {
        status: 'blocked',
        active_summary: `Awaiting human approval (Agent is L${agentLevel})`,
        error_message: null,
      });
      addActivity('permission_denied', `Task awaiting approval for L${agentLevel} agent ${agentDisplay(task.primary_agent_id).name}`, task.primary_agent_id);
      return;
    }

    updateTask(task.id, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
      active_summary: 'Queued for execution...',
      error_message: null,
    });
    addActivity('task_started', `Task started: ${task.title}`, task.primary_agent_id);
    await launchRun(task.id, 'primary');
  }, [claimMissionForExecution, launchRun, updateTask]);

  const handlePrimaryFinal = useCallback(async (task: Task, outputText: string) => {
    updateTask(task.id, {
      output_text: outputText,
      active_thinking: null,
    });

    if (task.review_enabled && task.review_agent_id) {
      const primaryAgent = agentDisplay(task.primary_agent_id);
      const reviewerAgent = agentDisplay(task.review_agent_id);
      updateTask(task.id, {
        status: 'review',
        active_summary: `Handed off from ${primaryAgent.name} to ${reviewerAgent.name} for review`,
      });
      addActivity('task_review_handoff', `Handed off from ${primaryAgent.name} to ${reviewerAgent.name}: ${task.title}`, task.review_agent_id);
      await launchRun(task.id, 'review');
      return;
    }

    await completeTask(task.id, outputText);
    addActivity('task_completed', `Task completed: ${task.title}`, task.primary_agent_id);
  }, [completeTask, launchRun, updateTask]);

  const handleReviewFinal = useCallback(async (task: Task, reviewText: string) => {
    const decision = parseReviewDecision(reviewText);

    const historyEntry: ReviewHistoryEntry = {
      round: task.revision_round,
      action: decision.action,
      summary: decision.summary,
      confidence_score: decision.confidenceScore,
      specific_issues: decision.specificIssues,
      new_instructions: decision.newInstructions,
      reviewer_agent_id: task.review_agent_id || '',
      reviewed_at: new Date().toISOString(),
    };
    const updatedHistory = [...(task.review_history || []), historyEntry];

    updateTask(task.id, { review_history: updatedHistory });

    if (decision.action === 'approve') {
      const summary = decision.summary || 'Review approved.';
      updateTask(task.id, {
        review_notes: summary,
        active_summary: summary,
      });
      await completeTask(task.id, task.output_text || '');
      addActivity('review_approved', `Review approved: ${task.title}`, task.review_agent_id || undefined);
      return;
    }

    if (decision.action === 'redo') {
      const instructions = decision.newInstructions || decision.summary || 'Please redo this task with a new approach.';
      const redoTask = createRedoTask(task, instructions, updatedHistory, decision.reassignAgentId);
      await startPrimaryIfDue(redoTask.id);
      return;
    }

    // action === 'revise'
    const hasRevisionLimit = task.max_revisions > 0;
    if (hasRevisionLimit && task.revision_round >= task.max_revisions) {
      const reason = decision.summary || 'Revision limit reached.';
      failTask(task.id, reason);
      updateTask(task.id, { review_notes: reason });
      addActivity('task_failed', `Task failed after max revisions: ${task.title}`, task.review_agent_id || undefined);
      return;
    }

    const followUpInstructions = decision.newInstructions || decision.summary || 'Please revise based on review feedback.';
    const revisionTask = createRevisionTask(task, followUpInstructions, updatedHistory);
    await startPrimaryIfDue(revisionTask.id);
  }, [completeTask, createRedoTask, createRevisionTask, failTask, startPrimaryIfDue, updateTask]);

  const startReviewIfReady = useCallback(async (taskId: string) => {
    const task = getTask(taskId);
    if (!task || task.status !== 'review' || !task.review_agent_id) return;
    updateTask(task.id, {
      active_summary: 'Queued for AI review...',
      error_message: null,
    });
    addActivity('task_review_started', `Review started: ${task.title}`, task.review_agent_id);
    await launchRun(task.id, 'review');
  }, [launchRun, updateTask]);

  const processRunEvent = useCallback(async (msg: OpenClawMessage) => {
    if (msg.type !== 'event' || msg.event !== 'chat') return;
    const payload = msg.payload as Record<string, unknown> | undefined;
    if (!payload) return;

    const eventRunId = typeof payload.runId === 'string' ? payload.runId : '';
    if (!eventRunId) return;

    const localRunId = runAliasRef.current.get(eventRunId)
      ?? (activeRunsRef.current.has(eventRunId) ? eventRunId : undefined);
    if (!localRunId) return;

    const run = activeRunsRef.current.get(localRunId);
    if (!run) return;

    const task = getTask(run.taskId);
    if (!task) {
      cleanupRun(localRunId);
      return;
    }

    const state = typeof payload.state === 'string' ? payload.state : '';
    const text = extractText(payload.message);

    if (state === 'delta') {
      if (text) {
        run.buffer = trimThinking(run.buffer + text);
        updateTask(task.id, {
          active_thinking: run.buffer,
          active_summary: run.phase === 'primary'
            ? `Working: ${agentDisplay(run.agentId).name}`
            : `Reviewing: ${agentDisplay(run.agentId).name}`,
        });
      }
      return;
    }

    if (state === 'error' || state === 'aborted') {
      const errorMessage = String(payload.errorMessage || `Run ${state}`);
      cleanupRun(localRunId);
      useMissionControlStore.getState().removeCheckpoint(run.taskId);
      failTask(task.id, errorMessage);
      addActivity('task_failed', `Task failed: ${task.title}`, run.agentId);
      return;
    }

    if (state !== 'final') return;

    const finalText = text || run.buffer;
    cleanupRun(localRunId);
    useMissionControlStore.getState().removeCheckpoint(run.taskId);

    if (run.phase === 'primary') {
      await handlePrimaryFinal(task, finalText);
      return;
    }

    await handleReviewFinal(task, finalText);
  }, [cleanupRun, failTask, handlePrimaryFinal, handleReviewFinal, updateTask]);

  const tick = useCallback(async () => {
    if (tickingRef.current) return;
    tickingRef.current = true;

    const tickStartedAt = Date.now();
    const tickNextAt = tickStartedAt + CHECK_INTERVAL_MS;
    useMissionControlStore
      .getState()
      .setSchedulerTick(
        new Date(tickStartedAt).toISOString(),
        new Date(tickNextAt).toISOString(),
      );

    try {
      if (activeRunsRef.current.size >= MAX_ACTIVE_RUNS) return;

      // Refresh the agent level cache each tick so permission checks are fresh
      await refreshAgentLevelCache();

      const now = Date.now();
      const tasks = useMissionControlStore.getState().tasks;
      const reviewTasks = tasks
        .filter((task) => task.status === 'review' && !task.active_run_id && !!task.review_agent_id)
        .sort((a, b) => parseTimeOrFallback(a.updated_at, now) - parseTimeOrFallback(b.updated_at, now));
      const dueTasks = tasks
        .filter((task) => {
          const isPending = task.status === 'todo' || task.status === 'blocked';
          return isPending
            && !task.active_run_id
            && !isRootMissionPlaceholder(task, tasks)
            && parseTimeOrFallback(task.due_at, 0) <= now;
        })
        // Sort by agent level descending (L4 first) for priority, then by due_at
        .sort((a, b) => {
          const levelA = getCachedAgentLevel(a.primary_agent_id).level;
          const levelB = getCachedAgentLevel(b.primary_agent_id).level;
          if (levelA !== levelB) return levelB - levelA;
          return parseTimeOrFallback(a.due_at, 0) - parseTimeOrFallback(b.due_at, 0);
        });

      const capacity = Math.max(0, MAX_ACTIVE_RUNS - activeRunsRef.current.size);
      if (capacity === 0) return;

      let remaining = capacity;
      for (const task of reviewTasks) {
        if (remaining <= 0) break;
        await startReviewIfReady(task.id);
        remaining -= 1;
      }

      if (remaining <= 0) return;
      for (const task of dueTasks.slice(0, remaining)) {
        await startPrimaryIfDue(task.id);
      }
    } finally {
      tickingRef.current = false;
    }
  }, [startPrimaryIfDue, startReviewIfReady]);

  const recoverStaleTasks = useCallback(() => {
    const now = Date.now();
    const { tasks, missions } = useMissionControlStore.getState();

    for (const task of tasks) {
      const isRunning = task.status === 'in_progress' || task.status === 'review';
      if (!isRunning) continue;

      const updatedMs = Date.parse(task.updated_at);
      const staleByTime = Number.isFinite(updatedMs) && now - updatedMs > STALE_RUN_GRACE_MS;
      const staleNoRun = !task.active_run_id;
      if (!staleByTime && !staleNoRun) continue;

      if (task.status === 'review' && task.review_enabled && task.review_agent_id) {
        updateTask(task.id, {
          status: 'review',
          active_phase: null,
          active_run_id: null,
          active_thinking: null,
          active_summary: 'Recovered after restart. Re-queueing review...',
          error_message: null,
        });
        addActivity('task_recovered', `Recovered review task after restart: ${task.title}`, task.review_agent_id);
        continue;
      }

      const missionId = task.root_task_id || task.id;
      const mission = missions.find((entry) => entry.id === missionId);
      const lifecycleReady = mission ? isMissionLifecycleReady(mission) : true;
      const unmetDependencies = getIncompleteDependencyTitles(task, tasks);
      const shouldBlock = !lifecycleReady || unmetDependencies.length > 0;
      const summary = !lifecycleReady
        ? `Recovered after restart. Waiting for ${mission?.mission_phase || 'tasks'} approval...`
        : unmetDependencies.length > 0
        ? `Recovered after restart. Blocked by: ${unmetDependencies.join(', ')}`
        : 'Recovered after restart. Re-queueing task...';

      updateTask(task.id, {
        status: shouldBlock ? 'blocked' : 'todo',
        active_phase: null,
        active_run_id: null,
        active_thinking: null,
        active_summary: summary,
        error_message: null,
      });
      addActivity('task_recovered', `Recovered task after restart: ${task.title}`, task.primary_agent_id);
    }
  }, [updateTask]);

  // Check if connection grace period has expired for any in-progress missions
  const checkGracePeriodExpiry = useCallback(() => {
    const store = useMissionControlStore.getState();
    const { connectionLostAt, tasks } = store;
    if (!connectionLostAt) return;

    const elapsed = Date.now() - connectionLostAt;
    if (elapsed < CONNECTION_GRACE_PERIOD_MS) return;

    // Grace period expired -- fail active runs that have no heartbeat
    for (const task of tasks) {
      const isRunning = task.status === 'in_progress' || task.status === 'review';
      if (!isRunning || !task.active_run_id) continue;

      updateTask(task.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        active_phase: null,
        active_run_id: null,
        active_thinking: null,
        active_summary: 'Failed: connection lost for too long.',
        error_message: `Connection lost for ${Math.round(elapsed / 1000)}s (grace period: ${CONNECTION_GRACE_PERIOD_MS / 1000}s).`,
      });
      addActivity('connection_timeout', `Mission failed after connection loss: ${task.title}`, task.primary_agent_id);
      store.removeCheckpoint(task.id);
    }

    store.setConnectionLostAt(null);
  }, [updateTask]);

  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    const offMessage = openclawClient.onMessage((msg) => {
      processRunEvent(msg).catch((err) => {
        console.error('[MissionScheduler] Failed processing run event:', err);
      });
    });

    // Monitor connection quality changes
    const offQuality = openclawClient.onQualityChange((quality) => {
      const store = useMissionControlStore.getState();
      store.setConnectionQuality(quality);

      if (quality === 'lost') {
        store.setReconnecting(true);
        // Mark affected in-progress tasks with connection warning
        for (const task of store.tasks) {
          const isRunning = task.status === 'in_progress' || task.status === 'review';
          if (!isRunning || !task.active_run_id) continue;
          store.updateTask(task.id, {
            ...task,
            active_summary: `Connection lost. Waiting to reconnect (grace: ${CONNECTION_GRACE_PERIOD_MS / 1000}s)...`,
            updated_at: new Date().toISOString(),
          });

          // Increment connection_drops in checkpoint
          const checkpoint = store.runCheckpoints[task.id];
          if (checkpoint) {
            store.saveCheckpoint(task.id, {
              ...checkpoint,
              buffer: task.active_thinking || checkpoint.buffer,
              connectionDrops: checkpoint.connectionDrops + 1,
            });
          }
        }
      } else if (quality === 'good') {
        store.setReconnecting(false);
        store.setConnectionLostAt(null);
      }
    });

    // On successful reconnection, recover stale tasks and re-tick
    const offReconnect = openclawClient.onReconnect(() => {
      console.log('[MissionScheduler] Connection restored, recovering tasks...');
      const store = useMissionControlStore.getState();
      store.setReconnecting(false);
      store.setConnectionLostAt(null);
      store.setConnectionQuality('good');
      addActivity('connection_restored', 'Connection restored. Recovering interrupted missions...');

      recoverStaleTasks();
      tick().catch((err) => {
        console.error('[MissionScheduler] Post-reconnect tick failed:', err);
      });
    });

    recoverStaleTasks();

    // Immediate startup scan plus minute-interval "cron".
    tick().catch((err) => {
      console.error('[MissionScheduler] Initial tick failed:', err);
    });
    const interval = setInterval(() => {
      tick().catch((err) => {
        console.error('[MissionScheduler] Tick failed:', err);
      });
    }, CHECK_INTERVAL_MS);

    // Periodically check grace period expiry
    const graceCheckInterval = setInterval(() => {
      checkGracePeriodExpiry();
    }, 30_000);

    return () => {
      offMessage();
      offQuality();
      offReconnect();
      clearInterval(interval);
      clearInterval(graceCheckInterval);
      initializingRef.current = false;
    };
  }, [checkGracePeriodExpiry, processRunEvent, recoverStaleTasks, tick]);

  useEffect(() => {
    if (!initializingRef.current) return;
    if (schedulerForceTickVersion === 0) return;
    tick().catch((err) => {
      console.error('[MissionScheduler] Manual tick failed:', err);
    });
  }, [schedulerForceTickVersion, tick]);
}
