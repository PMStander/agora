import { useEffect, useCallback } from 'react';
import {
  supabase,
  subscribeToMissions,
  subscribeToMissionLogs,
  logMissionEvent,
  isSupabaseConfigured,
} from '../lib/supabase';
import { missionStatusToTaskStatus, missionToTask } from '../lib/missionTaskMapping';
import { buildMissionPlanTemplate, validateMissionPlan } from '../lib/missionPlan';
import { getIncompleteDependencyTitles } from '../lib/taskDependencies';
import { useMissionControlStore } from '../stores/missionControl';
import type {
  Mission,
  MissionStatus,
  MissionPriority,
  MissionPhase,
  MissionPhaseStatus,
  Task,
  TaskStatus,
  TaskPriority,
  MediaAttachment,
} from '../types/supabase';
import { AGENTS } from '../types/supabase';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useMissionControl() {
  const {
    missions,
    logs,
    tasks,
    selectedMissionId,
    selectedTaskId,
    setMissions,
    addMission,
    updateMission,
    removeMission,
    setLogs,
    addLog,
    addTask,
    updateTask,
    removeTask,
    addActivity,
    requestSchedulerTick,
    setRealtimeLastEvent,
    setRealtimeStatus,
  } = useMissionControlStore();

  const upsertTaskForMission = useCallback((mission: Mission) => {
    const store = useMissionControlStore.getState();
    const existing = store.tasks.find((task) => task.id === mission.id);
    const mappedTask = missionToTask(mission, existing);
    if (existing) {
      store.updateTask(mission.id, mappedTask);
    } else {
      store.addTask(mappedTask);
    }
  }, []);

  // ── Initial fetch + real-time ──────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.warn('[MissionControl] Supabase not configured');
      return;
    }

    // Fetch missions
    supabase
      .from('missions')
      .select('*')
      .order('scheduled_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[MissionControl] Error fetching missions:', error);
        else if (data) {
          const missionsData = data as Mission[];
          setMissions(missionsData);
          missionsData.forEach((mission) => upsertTaskForMission(mission));
        }
      });

    // Real-time subscription
    const missionsSub = subscribeToMissions(
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const mission = payload.new as Mission;
          addMission(mission);
          upsertTaskForMission(mission);
          requestSchedulerTick();
        } else if (payload.eventType === 'UPDATE') {
          const mission = payload.new as Mission;
          updateMission(mission.id, mission);
          upsertTaskForMission(mission);
        } else if (payload.eventType === 'DELETE') {
          const missionId = String(payload.old.id);
          removeMission(missionId);
          removeTask(missionId);
        }
        setRealtimeLastEvent(`${payload.eventType} missions • ${new Date().toLocaleTimeString()}`);
      },
      (status) => {
        setRealtimeStatus(status);
      }
    );

    return () => {
      missionsSub.unsubscribe();
    };
  }, [addMission, removeMission, removeTask, requestSchedulerTick, setMissions, updateMission, upsertTaskForMission]);

  // ── Fetch logs for selected mission ────────────────────────────────────
  useEffect(() => {
    const selectedTask = selectedTaskId
      ? tasks.find((entry) => entry.id === selectedTaskId)
      : null;
    const missionIdFromSelectedTask = selectedTaskId
      ? selectedTask?.root_task_id
        || selectedTask?.id
        || null
      : null;
    const logsMissionId = selectedMissionId || missionIdFromSelectedTask;
    if (!logsMissionId || !isSupabaseConfigured()) {
      setLogs([]);
      return;
    }

    supabase
      .from('mission_logs')
      .select('*')
      .eq('mission_id', logsMissionId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[MissionControl] Error fetching logs:', error);
        else if (data) setLogs(data);
      });

    const logsSub = subscribeToMissionLogs(logsMissionId, (payload) => {
      if (payload.eventType === 'INSERT') {
        addLog(payload.new);
      }
    });

    return () => {
      logsSub.unsubscribe();
    };
  }, [addLog, selectedMissionId, selectedTaskId, setLogs, tasks]);

  // ── Create mission ─────────────────────────────────────────────────────
  const createMission = useCallback(
    async (
      data: {
        title: string;
        description?: string;
        input_text?: string;
        input_media?: Array<{ url: string; type: string; name: string }>;
        agent_id: string;
        priority?: MissionPriority;
        status?: MissionStatus;
        mission_status?: MissionStatus;
        scheduled_at: string;
        review_enabled?: boolean;
        review_agent_id?: string | null;
        max_revisions?: number;
        domains?: string[];
        mission_statement?: string;
        mission_plan?: string;
        mission_phase?: MissionPhase;
        mission_phase_status?: MissionPhaseStatus;
      }
    ) => {
      if (!isSupabaseConfigured()) return null;

      const initialPhase = data.mission_phase || 'statement';
      const initialPhaseStatus = data.mission_phase_status
        || (initialPhase === 'tasks' ? 'approved' : 'awaiting_approval');
      const missionStatement = data.mission_statement || data.input_text || data.description || null;
      const missionPlan = data.mission_plan || null;
      const initialStatus = data.status || 'scheduled';
      const initialMissionStatus = data.mission_status || initialStatus;

      const { data: mission, error } = await supabase
        .from('missions')
        .insert({
          title: data.title,
          description: data.description || null,
          status: initialStatus,
          mission_status: initialMissionStatus,
          mission_phase: initialPhase,
          mission_phase_status: initialPhaseStatus,
          mission_statement: missionStatement,
          mission_plan: missionPlan,
          priority: data.priority || 'medium',
          scheduled_at: data.scheduled_at,
          agent_id: data.agent_id,
          input_text: data.input_text || null,
          input_media: data.input_media || [],
          review_enabled: data.review_enabled || false,
          review_agent_id: data.review_agent_id || null,
          max_revisions: data.max_revisions || 1,
          revision_round: 0,
          output_text: null,
          output_media: [],
          parent_mission_id: null,
          review_notes: null,
          created_by: 'user',
          session_key: null,
          domains: data.domains || null,
        })
        .select()
        .single();

      if (error) {
        console.error('[MissionControl] Error creating mission:', error);
        return null;
      }

      await logMissionEvent(
        mission.id,
        'mission_created',
        `Mission "${data.title}" created and scheduled`
      );

      addMission(mission as Mission);
      upsertTaskForMission(mission as Mission);
      requestSchedulerTick();

      return mission;
    },
    [addMission, requestSchedulerTick, upsertTaskForMission]
  );

  // ── Update mission ─────────────────────────────────────────────────────
  const updateMissionDetails = useCallback(
    async (missionId: string, updates: Partial<Mission>) => {
      const now = new Date().toISOString();
      const patch = { ...updates, updated_at: now };

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('missions')
          .update(patch)
          .eq('id', missionId);

        if (error) {
          console.error('[MissionControl] Error updating mission:', error);
        }
      }

      updateMission(missionId, patch);
      const current = useMissionControlStore.getState().missions.find((entry) => entry.id === missionId);
      if (current) {
        upsertTaskForMission({ ...current, ...patch } as Mission);
      }
    },
    [updateMission, upsertTaskForMission]
  );

  // ── Move mission (status change) ──────────────────────────────────────
  const moveMission = useCallback(
    async (missionId: string, newStatus: MissionStatus) => {
      const now = new Date().toISOString();
      const extraUpdates: Partial<Mission> = {};

      if (newStatus === 'in_progress') extraUpdates.started_at = now;
      if (newStatus === 'done') extraUpdates.completed_at = now;

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('missions')
          .update({
            status: newStatus,
            mission_status: newStatus,
            updated_at: now,
            ...extraUpdates,
          })
          .eq('id', missionId);

        if (error) {
          console.error('[MissionControl] Error moving mission:', error);
          return;
        }
      }

      updateMission(missionId, {
        status: newStatus,
        mission_status: newStatus,
        updated_at: now,
        ...extraUpdates,
      });
      const taskUpdates: Partial<Task> = {
        status: missionStatusToTaskStatus(newStatus),
        updated_at: now,
      };
      if (extraUpdates.started_at) taskUpdates.started_at = extraUpdates.started_at;
      if (extraUpdates.completed_at) taskUpdates.completed_at = extraUpdates.completed_at;
      updateTask(missionId, taskUpdates);

      const mission = missions.find((m) => m.id === missionId);
      await logMissionEvent(
        missionId,
        'status_changed',
        `Mission "${mission?.title ?? 'Unknown'}" moved to ${newStatus}`
      );
    },
    [missions, updateMission, updateTask]
  );

  // ── Delete mission ─────────────────────────────────────────────────────
  const deleteMission = useCallback(async (missionId: string) => {
    if (!isSupabaseConfigured()) return;

    // Delete logs first
    await supabase.from('mission_logs').delete().eq('mission_id', missionId);

    const { error } = await supabase.from('missions').delete().eq('id', missionId);

    if (error) {
      console.error('[MissionControl] Error deleting mission:', error);
    }
  }, []);

  // ── Task Management ─────────────────────────────────────────────────────
  const createTask = useCallback(
    async (
      data: {
        title: string;
        description?: string;
        inputText?: string;
        dueAt: string;
        primaryAgentId: string;
        priority?: TaskPriority;
        domains?: string[];
        assigneeIds?: string[];
        media?: MediaAttachment[];
        reviewEnabled?: boolean;
        reviewAgentId?: string | null;
        maxRevisions?: number;
        parentTaskId?: string | null;
        rootTaskId?: string | null;
        revisionRound?: number;
        dependencyTaskIds?: string[];
      }
    ) => {
      const assigneeIds = data.assigneeIds?.length ? data.assigneeIds : [data.primaryAgentId];
      const assignees = assigneeIds.map((id) => {
        const agent = AGENTS.find((a) => a.id === id);
        return agent ? { id: agent.id, name: agent.name, emoji: agent.emoji } : { id, name: 'Unknown', emoji: '?' };
      });
      const dependencyTaskIds = Array.from(new Set(data.dependencyTaskIds || []));
      const unmetDependencies = getIncompleteDependencyTitles(
        {
          id: '__draft__',
          title: data.title,
          description: data.description || null,
          status: 'todo',
          priority: data.priority || 'medium',
          domains: data.domains || [],
          assignees,
          due_at: data.dueAt,
          started_at: null,
          completed_at: null,
          primary_agent_id: data.primaryAgentId,
          review_enabled: data.reviewEnabled || false,
          review_agent_id: data.reviewEnabled ? (data.reviewAgentId || null) : null,
          max_revisions: data.reviewEnabled ? (data.maxRevisions ?? 0) : 0,
          revision_round: data.revisionRound || 0,
          parent_task_id: data.parentTaskId || null,
          root_task_id: data.rootTaskId || null,
          input_text: data.inputText || data.description || null,
          input_media: data.media || [],
          output_text: null,
          review_notes: null,
          review_history: [],
          dependency_task_ids: dependencyTaskIds,
          linked_revision_task_id: null,
          active_run_id: null,
          active_phase: null,
          active_thinking: null,
          active_summary: null,
          error_message: null,
          created_at: '',
          updated_at: '',
        } as Task,
        useMissionControlStore.getState().tasks
      );

      const now = new Date().toISOString();
      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        title: data.title,
        description: data.description || null,
        status: unmetDependencies.length > 0 ? 'blocked' : 'todo',
        priority: data.priority || 'medium',
        domains: data.domains || [],
        assignees,
        due_at: data.dueAt,
        started_at: null,
        completed_at: null,
        primary_agent_id: data.primaryAgentId,
        review_enabled: data.reviewEnabled || false,
        review_agent_id: data.reviewEnabled ? (data.reviewAgentId || null) : null,
        max_revisions: data.reviewEnabled ? (data.maxRevisions ?? 0) : 0,
        revision_round: data.revisionRound || 0,
        parent_task_id: data.parentTaskId || null,
        root_task_id: data.rootTaskId || null,
        input_text: data.inputText || data.description || null,
        input_media: data.media || [],
        output_text: null,
        review_notes: null,
        review_history: [],
        dependency_task_ids: dependencyTaskIds,
        linked_revision_task_id: null,
        active_run_id: null,
        active_phase: null,
        active_thinking: null,
        active_summary: unmetDependencies.length > 0
          ? `Blocked by: ${unmetDependencies.join(', ')}`
          : null,
        error_message: null,
        created_at: now,
        updated_at: now,
      };
      addTask(newTask);
      requestSchedulerTick();
      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'task_created',
        message: `Task created: ${newTask.title}`,
        agent: assignees[0] ?? null,
        created_at: now,
      });
      return newTask;
    },
    [addActivity, addTask, requestSchedulerTick]
  );

  const moveTask = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      const store = useMissionControlStore.getState();
      const task = store.tasks.find((entry) => entry.id === taskId);
      if (!task) return;

      const now = new Date().toISOString();
      const unmetDependencies = getIncompleteDependencyTitles(task, store.tasks);

      if (newStatus === 'in_progress' && unmetDependencies.length > 0) {
        updateTask(taskId, {
          status: 'blocked',
          active_summary: `Blocked by: ${unmetDependencies.join(', ')}`,
          updated_at: now,
        });
        addActivity({
          id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'task_blocked',
          message: `Task blocked by dependencies: ${task.title}`,
          agent: task.assignees[0] ?? null,
          created_at: now,
        });
        return;
      }

      const next: Partial<Task> = {
        status: newStatus === 'todo' && unmetDependencies.length > 0 ? 'blocked' : newStatus,
        updated_at: now,
        active_summary: newStatus === 'todo' && unmetDependencies.length > 0
          ? `Blocked by: ${unmetDependencies.join(', ')}`
          : null,
      };
      if (newStatus === 'in_progress') next.started_at = now;
      if (newStatus === 'done' || newStatus === 'failed') next.completed_at = now;
      updateTask(taskId, next);
      requestSchedulerTick();
      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'task_moved',
        message: `Task moved to ${next.status}: ${task.title}`,
        agent: task.assignees[0] ?? null,
        created_at: now,
      });
    },
    [addActivity, requestSchedulerTick, updateTask]
  );

  const assignTask = useCallback(
    (taskId: string, agentIds: string[]) => {
      const assignees = agentIds.map((id) => {
        const agent = AGENTS.find((a) => a.id === id);
        return agent ? { id: agent.id, name: agent.name, emoji: agent.emoji } : { id, name: 'Unknown', emoji: '?' };
      });
      updateTask(taskId, { assignees, updated_at: new Date().toISOString() });
    },
    [updateTask]
  );

  const updateTaskDetails = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      const store = useMissionControlStore.getState();
      const current = store.tasks.find((entry) => entry.id === taskId);
      if (!current) return;

      const patch: Partial<Task> = { ...updates, updated_at: new Date().toISOString() };
      if (Array.isArray(updates.dependency_task_ids)) {
        patch.dependency_task_ids = Array.from(new Set(updates.dependency_task_ids));
      }

      const merged = { ...current, ...patch } as Task;
      const unmetDependencies = getIncompleteDependencyTitles(merged, store.tasks);
      const statusAfterPatch = patch.status || current.status;
      if (statusAfterPatch === 'todo' || statusAfterPatch === 'blocked' || statusAfterPatch === 'in_progress') {
        patch.status = unmetDependencies.length > 0 ? 'blocked' : (statusAfterPatch === 'blocked' ? 'todo' : statusAfterPatch);
      }
      patch.active_summary = unmetDependencies.length > 0
        ? `Blocked by: ${unmetDependencies.join(', ')}`
        : patch.status === 'blocked'
        ? null
        : (patch.active_summary
          ?? (current.active_summary?.startsWith('Blocked by:') ? null : current.active_summary));

      updateTask(taskId, patch);
      requestSchedulerTick();
    },
    [requestSchedulerTick, updateTask]
  );

  const addComment = useCallback(
    (taskId: string, content: string) => {
      // This is a placeholder - in a real app, you'd store comments separately
      console.log(`Adding comment to task ${taskId}: ${content}`);
    },
    []
  );

  const approveMissionStatement = useCallback(async (missionId: string, statementText?: string): Promise<boolean | { ok: false; error: string }> => {
    const mission = useMissionControlStore.getState().missions.find((entry) => entry.id === missionId);
    if (!mission) return { ok: false, error: 'Mission not found.' };

    // Guard: only allow transition from statement phase
    if (mission.mission_phase && mission.mission_phase !== 'statement') {
      return { ok: false, error: `Cannot approve statement: mission is in "${mission.mission_phase}" phase, expected "statement".` };
    }

    const statement = statementText?.trim()
      || mission.mission_statement
      || mission.input_text
      || mission.description
      || null;

    // Guard: statement must be non-empty
    if (!statement || statement.trim().length === 0) {
      return { ok: false, error: 'Mission statement cannot be empty.' };
    }

    const now = new Date().toISOString();
    const patch: Partial<Mission> = {
      mission_statement: statement,
      mission_phase: 'plan',
      mission_phase_status: 'awaiting_approval',
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('missions')
        .update(patch)
        .eq('id', missionId);

      if (error) {
        console.error('[MissionControl] Error approving mission statement:', error);
        return false;
      }
    }

    updateMission(missionId, patch);
    upsertTaskForMission({ ...mission, ...patch } as Mission);
    await logMissionEvent(
      missionId,
      'statement_approved',
      `Mission statement approved for "${mission.title}"`
    );
    return true;
  }, [updateMission, upsertTaskForMission]);

  const approveMissionPlan = useCallback(async (missionId: string, planText?: string): Promise<{ ok: boolean; createdTasks: number; errors?: string[] }> => {
    const store = useMissionControlStore.getState();
    const mission = store.missions.find((entry) => entry.id === missionId);
    if (!mission) return { ok: false, createdTasks: 0, errors: ['Mission not found.'] };

    // Guard: only allow transition from plan phase (or tasks phase for re-generation)
    if (mission.mission_phase && mission.mission_phase !== 'plan' && mission.mission_phase !== 'tasks') {
      return { ok: false, createdTasks: 0, errors: [`Cannot approve plan: mission is in "${mission.mission_phase}" phase. Approve the statement first.`] };
    }

    const resolvedPlan = planText?.trim()
      || mission.mission_plan
      || buildMissionPlanTemplate(mission);

    // Validate plan structure
    const validation = validateMissionPlan(resolvedPlan, mission);
    if (!validation.valid) {
      return { ok: false, createdTasks: 0, errors: validation.errors };
    }

    const blueprints = validation.blueprints;
    if (blueprints.length === 0) {
      return { ok: false, createdTasks: 0, errors: ['No valid tasks found in plan.'] };
    }

    const existingChildren = store.tasks.filter((task) => {
      return (task.root_task_id || task.id) === missionId && task.id !== missionId;
    });
    for (const task of existingChildren) {
      removeTask(task.id);
    }

    const createdByKey = new Map<string, Task>();
    for (const blueprint of blueprints) {
      const task = await createTask({
        title: blueprint.title,
        description: blueprint.instructions,
        inputText: blueprint.instructions,
        dueAt: new Date(Date.now() + blueprint.due_offset_minutes * 60_000).toISOString(),
        primaryAgentId: blueprint.agent_id,
        priority: blueprint.priority,
        domains: blueprint.domains,
        assigneeIds: [blueprint.agent_id],
        reviewEnabled: blueprint.review_enabled,
        reviewAgentId: blueprint.review_enabled ? blueprint.review_agent_id : null,
        maxRevisions: blueprint.review_enabled ? blueprint.max_revisions : 0,
        rootTaskId: mission.id,
        dependencyTaskIds: [],
      });
      createdByKey.set(blueprint.key, task);
    }

    for (const blueprint of blueprints) {
      const task = createdByKey.get(blueprint.key);
      if (!task) continue;
      const dependencyTaskIds = blueprint.depends_on
        .map((dependencyKey) => createdByKey.get(dependencyKey)?.id)
        .filter((id): id is string => Boolean(id));
      const dependencyTitles = blueprint.depends_on
        .map((dependencyKey) => createdByKey.get(dependencyKey)?.title)
        .filter((title): title is string => Boolean(title));
      const blockedByDependencies = dependencyTaskIds.length > 0;
      updateTask(task.id, {
        dependency_task_ids: dependencyTaskIds,
        status: blockedByDependencies ? 'blocked' : 'todo',
        active_summary: blockedByDependencies ? `Blocked by: ${dependencyTitles.join(', ')}` : null,
        updated_at: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();
    const nextMissionStatus: MissionStatus = createdByKey.size > 0 ? 'assigned' : (mission.mission_status || mission.status);
    const patch: Partial<Mission> = {
      mission_plan: resolvedPlan,
      mission_phase: 'tasks',
      mission_phase_status: 'approved',
      mission_status: nextMissionStatus,
      status: nextMissionStatus,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('missions')
        .update(patch)
        .eq('id', missionId);

      if (error) {
        console.error('[MissionControl] Error approving mission plan:', error);
        return { ok: false, createdTasks: 0 };
      }
    }

    updateMission(missionId, patch);
    upsertTaskForMission({ ...mission, ...patch } as Mission);
    requestSchedulerTick();
    await logMissionEvent(
      missionId,
      'plan_approved',
      `Mission plan approved and ${createdByKey.size} tasks created for "${mission.title}"`
    );
    return { ok: true, createdTasks: createdByKey.size };
  }, [createTask, removeTask, requestSchedulerTick, updateMission, updateTask, upsertTaskForMission]);

  const reopenMissionWithFeedback = useCallback(async (missionId: string, feedback: string) => {
    const mission = useMissionControlStore.getState().missions.find((entry) => entry.id === missionId);
    if (!mission) return false;

    const now = new Date().toISOString();
    const patch: Partial<Mission> = {
      feedback_text: feedback.trim() || null,
      reopened_at: now,
      mission_status: 'in_progress',
      status: 'in_progress',
      mission_phase: 'tasks',
      mission_phase_status: 'approved',
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('missions')
        .update(patch)
        .eq('id', missionId);

      if (error) {
        console.error('[MissionControl] Error reopening mission with feedback:', error);
        return false;
      }
    }

    updateMission(missionId, patch);
    upsertTaskForMission({ ...mission, ...patch } as Mission);
    requestSchedulerTick();
    await logMissionEvent(
      missionId,
      'feedback_reopened',
      `Mission reopened with feedback: ${feedback.trim()}`
    );
    return true;
  }, [requestSchedulerTick, updateMission, upsertTaskForMission]);

  return {
    missions,
    logs,
    tasks,
    createMission,
    updateMissionDetails,
    moveMission,
    deleteMission,
    // Task methods
    createTask,
    moveTask,
    assignTask,
    updateTaskDetails,
    approveMissionStatement,
    approveMissionPlan,
    reopenMissionWithFeedback,
    addComment,
    agents: AGENTS,
    isConfigured: isSupabaseConfigured(),
  };
}
