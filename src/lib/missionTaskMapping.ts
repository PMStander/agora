import {
  AGENTS,
  type Mission,
  type MissionStatus,
  type Task,
  type TaskStatus,
} from '../types/supabase';

const AGENT_ALIASES: Record<string, string> = {
  'marcus-aurelius': 'main',
};

function resolveAgentId(agentId: string): string {
  if (AGENTS.some((agent) => agent.id === agentId)) return agentId;
  return AGENT_ALIASES[agentId] || agentId;
}

export function missionStatusToTaskStatus(status: MissionStatus): TaskStatus {
  switch (status) {
    case 'in_progress':
      return 'in_progress';
    case 'pending_review':
      return 'review';
    case 'done':
      return 'done';
    case 'failed':
      return 'failed';
    case 'revision':
      return 'todo';
    case 'assigned':
      return 'todo';
    case 'scheduled':
      return 'todo';
    default:
      return 'todo';
  }
}

export function taskStatusToMissionStatus(status: TaskStatus, revisionRound: number): MissionStatus {
  switch (status) {
    case 'blocked':
      return 'assigned';
    case 'in_progress':
      return 'in_progress';
    case 'review':
      return 'pending_review';
    case 'done':
      return 'done';
    case 'failed':
      return 'failed';
    case 'todo':
      return revisionRound > 0 ? 'revision' : 'scheduled';
    default:
      return revisionRound > 0 ? 'revision' : 'scheduled';
  }
}

function buildAssignees(agentId: string): Task['assignees'] {
  const resolvedAgentId = resolveAgentId(agentId);
  const agent = AGENTS.find((entry) => entry.id === resolvedAgentId);
  if (!agent) {
    return [{ id: resolvedAgentId, name: resolvedAgentId, emoji: '🤖' }];
  }
  return [{ id: agent.id, name: agent.name, emoji: agent.emoji }];
}

export function missionToTask(mission: Mission, previous?: Task): Task {
  const resolvedPrimaryAgent = resolveAgentId(mission.agent_id);
  const resolvedReviewAgent = mission.review_agent_id
    ? resolveAgentId(mission.review_agent_id)
    : null;
  const missionPhase = mission.mission_phase || 'tasks';
  const missionPhaseStatus = mission.mission_phase_status || 'approved';
  const executionStatus = mission.mission_status || mission.status;
  const mappedStatus = missionStatusToTaskStatus(executionStatus);
  const lifecycleReady = missionPhase === 'tasks' && missionPhaseStatus === 'approved';
  const effectiveStatus: TaskStatus = lifecycleReady ? mappedStatus : 'blocked';
  const isTerminal = effectiveStatus === 'done' || effectiveStatus === 'failed';
  const preserveLocalRunningState = Boolean(
    previous
      && (previous.status === 'in_progress' || previous.status === 'review')
      && effectiveStatus === 'todo'
  );

  return {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    status: preserveLocalRunningState ? previous!.status : effectiveStatus,
    priority: mission.priority,
    domains: mission.domains ?? [],
    assignees: buildAssignees(mission.agent_id),
    due_at: mission.scheduled_at,
    started_at: mission.started_at,
    completed_at: mission.completed_at,
    primary_agent_id: resolvedPrimaryAgent,
    review_enabled: mission.review_enabled,
    review_agent_id: resolvedReviewAgent,
    max_revisions: mission.max_revisions,
    revision_round: mission.revision_round,
    parent_task_id: mission.parent_mission_id,
    root_task_id: mission.parent_mission_id || mission.id,
    input_text: missionPhase === 'statement'
      ? (mission.mission_statement || mission.input_text)
      : missionPhase === 'plan'
      ? (mission.mission_plan || mission.input_text)
      : mission.input_text,
    input_media: mission.input_media,
    output_text: mission.output_text,
    review_notes: mission.review_notes,
    review_history: previous?.review_history ?? [],
    dependency_task_ids: previous?.dependency_task_ids ?? [],
    linked_revision_task_id: previous?.linked_revision_task_id ?? null,
    active_run_id: isTerminal ? null : previous?.active_run_id ?? null,
    active_phase: isTerminal ? null : previous?.active_phase ?? null,
    active_thinking: isTerminal ? null : previous?.active_thinking ?? null,
    active_summary: !lifecycleReady
      ? `Waiting for ${missionPhase} approval`
      : isTerminal
      ? (effectiveStatus === 'done' ? 'Mission completed.' : previous?.active_summary ?? null)
      : previous?.active_summary ?? null,
    error_message: effectiveStatus === 'failed' ? (previous?.error_message ?? null) : null,
    created_at: mission.created_at,
    updated_at: mission.updated_at,
  };
}
