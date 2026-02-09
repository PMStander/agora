import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import { tryActivateNextPhase, getReadyTasks, injectUpstreamContext, reevaluateTaskReadiness } from '../lib/planEngine';
import type {
  MissionPlan,
  PlanPhase,
  PlanTask,
  PlanTaskEdge,
  PlanTaskRun,
  PlanTaskStatus,
  NormalizedPlanRows,
} from '../types/missionPlan';

// ─── DB ↔ TypeScript Column Mapping Helpers ──────────────────────────────────

/** Convert a plan_phases DB row to PlanPhase (phase_order → phase_index). */
function dbPhaseToTs(row: Record<string, unknown>): PlanPhase {
  const { phase_order, ...rest } = row as Record<string, unknown> & { phase_order: number };
  return { ...rest, phase_index: phase_order } as unknown as PlanPhase;
}

/** Convert a plan_tasks DB row to PlanTask (task_key → key). */
function dbTaskToTs(row: Record<string, unknown>): PlanTask {
  const { task_key, ...rest } = row as Record<string, unknown> & { task_key: string };
  return { ...rest, key: task_key } as unknown as PlanTask;
}

/** Convert a plan_task_edges DB row to PlanTaskEdge (from_task_id/to_task_id → source_task_id/target_task_id). */
function dbEdgeToTs(row: Record<string, unknown>): PlanTaskEdge {
  const { from_task_id, to_task_id, ...rest } = row as Record<string, unknown> & {
    from_task_id: string;
    to_task_id: string;
  };
  return {
    ...rest,
    id: `${from_task_id}:${to_task_id}`,
    source_task_id: from_task_id,
    target_task_id: to_task_id,
  } as unknown as PlanTaskEdge;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useMissionPlan(missionId: string | null) {
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [phases, setPhases] = useState<PlanPhase[]>([]);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [edges, setEdges] = useState<PlanTaskEdge[]>([]);
  const [runs, setRuns] = useState<PlanTaskRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // ── Fetch latest plan + phases + tasks + edges ──

  const fetchPlan = useCallback(async (mid: string) => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch latest plan by version DESC
      const { data: planRow, error: planErr } = await supabase
        .from('mission_plans')
        .select('*')
        .eq('mission_id', mid)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planErr) throw planErr;
      if (!planRow) {
        setPlan(null);
        setPhases([]);
        setTasks([]);
        setEdges([]);
        setRuns([]);
        setLoading(false);
        return;
      }

      const planTs = planRow as unknown as MissionPlan;
      setPlan(planTs);

      // Fetch phases and tasks in parallel (both filtered by plan_id)
      const [phasesRes, tasksRes] = await Promise.all([
        supabase
          .from('plan_phases')
          .select('*')
          .eq('plan_id', planTs.id)
          .order('phase_order', { ascending: true }),
        supabase
          .from('plan_tasks')
          .select('*')
          .eq('plan_id', planTs.id)
          .order('sort_order', { ascending: true }),
      ]);

      if (phasesRes.error) throw phasesRes.error;
      if (tasksRes.error) throw tasksRes.error;

      const phasesTs = (phasesRes.data || []).map(dbPhaseToTs);
      const tasksTs = (tasksRes.data || []).map(dbTaskToTs);

      setPhases(phasesTs);
      setTasks(tasksTs);

      // Fetch edges and runs using the resolved task IDs
      const taskIds = tasksTs.map((t) => t.id);

      if (taskIds.length > 0) {
        const [edgesRes, runsRes] = await Promise.all([
          supabase
            .from('plan_task_edges')
            .select('*')
            .or(`from_task_id.in.(${taskIds.join(',')}),to_task_id.in.(${taskIds.join(',')})`),
          supabase
            .from('plan_task_runs')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: false }),
        ]);

        if (edgesRes.error) throw edgesRes.error;
        if (runsRes.error) throw runsRes.error;

        setEdges((edgesRes.data || []).map(dbEdgeToTs));
        setRuns((runsRes.data || []) as PlanTaskRun[]);
      } else {
        setEdges([]);
        setRuns([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MissionPlan] Error fetching plan:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial fetch ──

  useEffect(() => {
    if (!isSupabaseConfigured() || !missionId || initializedRef.current) return;
    initializedRef.current = true;

    fetchPlan(missionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  // Reset when missionId changes (including to null)
  const prevMissionIdRef = useRef<string | null>(missionId);
  useEffect(() => {
    if (prevMissionIdRef.current === missionId) return;
    prevMissionIdRef.current = missionId;

    if (!missionId) {
      initializedRef.current = false;
      setPlan(null);
      setPhases([]);
      setTasks([]);
      setEdges([]);
      setRuns([]);
      setError(null);
      return;
    }

    // missionId changed to a new value — re-fetch
    initializedRef.current = true;
    fetchPlan(missionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  // ── Realtime subscriptions scoped to current plan_id ──

  useEffect(() => {
    if (!isSupabaseConfigured() || !plan?.id) return;

    const planId = plan.id;

    const phasesSub = supabase
      .channel(`plan-phases-${planId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_phases', filter: `plan_id=eq.${planId}` },
        (payload) =>
          handleRealtimePayload<PlanPhase>(
            payload,
            (item) => {
              const ts = dbPhaseToTs(item as unknown as Record<string, unknown>);
              setPhases((prev) =>
                [...prev.filter((p) => p.id !== ts.id), ts].sort((a, b) => a.phase_index - b.phase_index)
              );
            },
            (id, updates) => {
              setPhases((prev) =>
                prev.map((p) => {
                  if (p.id !== id) return p;
                  const merged = { ...p, ...updates } as unknown as Record<string, unknown>;
                  return dbPhaseToTs(merged);
                })
              );
            },
            (id) => setPhases((prev) => prev.filter((p) => p.id !== id))
          )
      )
      .subscribe();

    const tasksSub = supabase
      .channel(`plan-tasks-${planId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_tasks', filter: `plan_id=eq.${planId}` },
        (payload) =>
          handleRealtimePayload<PlanTask>(
            payload,
            (item) => {
              const ts = dbTaskToTs(item as unknown as Record<string, unknown>);
              setTasks((prev) =>
                [...prev.filter((t) => t.id !== ts.id), ts].sort((a, b) => a.sort_order - b.sort_order)
              );
            },
            (id, updates) => {
              setTasks((prev) =>
                prev.map((t) => {
                  if (t.id !== id) return t;
                  const merged = { ...t, ...updates } as unknown as Record<string, unknown>;
                  return dbTaskToTs(merged);
                })
              );
            },
            (id) => setTasks((prev) => prev.filter((t) => t.id !== id))
          )
      )
      .subscribe();

    const runsSub = supabase
      .channel(`plan-task-runs-${planId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'plan_task_runs' },
        (payload) => {
          const run = payload.new as PlanTaskRun;
          // Only add if it belongs to one of our plan's tasks
          setTasks((currentTasks) => {
            const taskIds = new Set(currentTasks.map((t) => t.id));
            if (taskIds.has(run.task_id)) {
              setRuns((prev) => [run, ...prev]);
            }
            return currentTasks;
          });
        }
      )
      .subscribe();

    return () => {
      phasesSub.unsubscribe();
      tasksSub.unsubscribe();
      runsSub.unsubscribe();
    };
  }, [plan?.id]);

  // ── Create Plan ──

  const createPlan = useCallback(
    async (rows: NormalizedPlanRows): Promise<MissionPlan | null> => {
      if (!isSupabaseConfigured()) return null;
      setError(null);

      try {
        // 1. Generate real UUIDs
        const realPlanId = crypto.randomUUID();

        // Map placeholder phase_id → real UUID. Phases in NormalizedPlanRows have
        // plan_id set to a placeholder and phase_index as their ordering key.
        // Tasks reference these placeholder phase_ids via their phase_id field.
        // Collect the unique placeholder phase_ids used by tasks, ordered by the
        // phases' phase_index, and assign each a real UUID.
        const sortedPhases = [...rows.phases].sort((a, b) => a.phase_index - b.phase_index);
        const phaseRealIds: string[] = sortedPhases.map(() => crypto.randomUUID());

        // Build placeholder phase_id → real UUID map.
        // Strategy: each task's phase_id is a placeholder string. Collect unique values
        // in the order they first appear (which should correspond to phase_index order),
        // then zip with the sorted phases.
        const seenPlaceholderPhaseIds: string[] = [];
        for (const task of rows.tasks) {
          if (!seenPlaceholderPhaseIds.includes(task.phase_id)) {
            seenPlaceholderPhaseIds.push(task.phase_id);
          }
        }
        // Also include phase placeholders from phases themselves that might have no tasks
        for (let i = 0; i < sortedPhases.length; i++) {
          const phase = sortedPhases[i];
          // If no tasks reference this phase, add a synthetic placeholder
          if (i >= seenPlaceholderPhaseIds.length) {
            seenPlaceholderPhaseIds.push(`__phase_${phase.phase_index}`);
          }
        }

        const placeholderPhaseToReal = new Map<string, string>();
        for (let i = 0; i < seenPlaceholderPhaseIds.length && i < phaseRealIds.length; i++) {
          placeholderPhaseToReal.set(seenPlaceholderPhaseIds[i], phaseRealIds[i]);
        }

        // Map task key → real UUID
        const taskRealIdByKey = new Map<string, string>();
        for (const task of rows.tasks) {
          taskRealIdByKey.set(task.key, crypto.randomUUID());
        }

        // 2. Insert plan
        const { data: insertedPlan, error: planErr } = await supabase
          .from('mission_plans')
          .insert({
            id: realPlanId,
            mission_id: rows.plan.mission_id,
            version: rows.plan.version,
            status: rows.plan.status,
            plan_summary: rows.plan.description || rows.plan.title || null,
            created_by: rows.plan.created_by,
            approved_by: rows.plan.approved_by || null,
            approved_at: rows.plan.approved_at || null,
          })
          .select()
          .single();

        if (planErr) throw planErr;

        // 3. Insert phases
        if (sortedPhases.length > 0) {
          const phaseRows = sortedPhases.map((phase, idx) => ({
            id: phaseRealIds[idx],
            plan_id: realPlanId,
            phase_order: phase.phase_index,
            title: phase.title,
            description: phase.description || null,
            gate_type: phase.gate_type,
            status: phase.status,
          }));

          const { error: phaseErr } = await supabase
            .from('plan_phases')
            .insert(phaseRows);
          if (phaseErr) throw phaseErr;
        }

        // 4. Insert tasks
        if (rows.tasks.length > 0) {
          const taskRows = rows.tasks.map((task) => ({
            id: taskRealIdByKey.get(task.key)!,
            phase_id: placeholderPhaseToReal.get(task.phase_id) || task.phase_id,
            plan_id: realPlanId,
            mission_id: rows.plan.mission_id,
            task_key: task.key,
            title: task.title,
            instructions: task.instructions,
            agent_id: task.agent_id,
            priority: task.priority,
            domains: task.domains,
            review_enabled: task.review_enabled,
            review_agent_id: task.review_agent_id || null,
            status: task.status,
            input_context: task.input_context || {},
            output_text: task.output_text || null,
            output_artifacts: task.output_artifacts || [],
            sort_order: task.sort_order,
          }));

          const { error: taskErr } = await supabase
            .from('plan_tasks')
            .insert(taskRows);
          if (taskErr) throw taskErr;
        }

        // 5. Insert edges
        if (rows.edges.length > 0) {
          const edgeRows = rows.edges.map((edge) => ({
            from_task_id: taskRealIdByKey.get(edge.source_task_id) || edge.source_task_id,
            to_task_id: taskRealIdByKey.get(edge.target_task_id) || edge.target_task_id,
            edge_type: edge.edge_type,
          }));

          const { error: edgeErr } = await supabase
            .from('plan_task_edges')
            .insert(edgeRows);
          if (edgeErr) throw edgeErr;
        }

        const planTs = insertedPlan as unknown as MissionPlan;
        setPlan(planTs);

        // Re-fetch to populate all child state with real timestamps
        await fetchPlan(rows.plan.mission_id);

        return planTs;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[MissionPlan] Error creating plan:', msg);
        setError(msg);
        return null;
      }
    },
    [fetchPlan]
  );

  // ── Approve Plan ──

  const approvePlan = useCallback(
    async (planId: string, approvedBy: string): Promise<void> => {
      if (!isSupabaseConfigured()) return;
      setError(null);

      try {
        const now = new Date().toISOString();

        const { error: planErr } = await supabase
          .from('mission_plans')
          .update({ status: 'approved', approved_by: approvedBy, approved_at: now, updated_at: now })
          .eq('id', planId);
        if (planErr) throw planErr;

        // Update mission.active_plan_id
        if (plan?.mission_id) {
          const { error: missionErr } = await supabase
            .from('missions')
            .update({ active_plan_id: planId })
            .eq('id', plan.mission_id);
          if (missionErr) throw missionErr;
        }

        // Supersede any other approved plans for this mission
        if (plan?.mission_id) {
          await supabase
            .from('mission_plans')
            .update({ status: 'superseded', updated_at: now })
            .eq('mission_id', plan.mission_id)
            .eq('status', 'approved')
            .neq('id', planId);
        }

        setPlan((prev) =>
          prev && prev.id === planId
            ? { ...prev, status: 'approved', approved_by: approvedBy, approved_at: now }
            : prev
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[MissionPlan] Error approving plan:', msg);
        setError(msg);
      }
    },
    [plan?.mission_id]
  );

  // ── Reject Plan ──

  const rejectPlan = useCallback(
    async (planId: string): Promise<void> => {
      if (!isSupabaseConfigured()) return;
      setError(null);

      try {
        const now = new Date().toISOString();
        const { error: planErr } = await supabase
          .from('mission_plans')
          .update({ status: 'rejected', updated_at: now })
          .eq('id', planId);
        if (planErr) throw planErr;

        setPlan((prev) =>
          prev && prev.id === planId
            ? { ...prev, status: 'rejected' as MissionPlan['status'] }
            : prev
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[MissionPlan] Error rejecting plan:', msg);
        setError(msg);
      }
    },
    []
  );

  // ── Update Task Status ──

  const updateTaskStatus = useCallback(
    async (taskId: string, status: PlanTaskStatus, extra?: Partial<PlanTask>): Promise<void> => {
      if (!isSupabaseConfigured()) return;
      setError(null);

      try {
        const now = new Date().toISOString();

        // Map TS fields to DB columns
        const dbUpdates: Record<string, unknown> = {
          status,
          updated_at: now,
        };

        if (extra) {
          if (extra.output_text !== undefined) dbUpdates.output_text = extra.output_text;
          if (extra.output_artifacts !== undefined) dbUpdates.output_artifacts = extra.output_artifacts;
          if (extra.input_context !== undefined) dbUpdates.input_context = extra.input_context;
          if (extra.error_message !== undefined) dbUpdates.error_message = extra.error_message;
          if (extra.started_at !== undefined) dbUpdates.started_at = extra.started_at;
          if (extra.completed_at !== undefined) dbUpdates.completed_at = extra.completed_at;
          if (extra.revision_round !== undefined) dbUpdates.revision_round = extra.revision_round;
          if (extra.key !== undefined) dbUpdates.task_key = extra.key;
        }

        const { error: taskErr } = await supabase
          .from('plan_tasks')
          .update(dbUpdates)
          .eq('id', taskId);
        if (taskErr) throw taskErr;

        // Optimistic local update
        setTasks((prev) => {
          const updatedTasks = prev.map((t) =>
            t.id === taskId ? { ...t, status, ...extra, updated_at: now } : t
          );
          
          // ── Intra-phase dependency reevaluation ─────────────────────────
          // When a task completes (done or skipped), check if any other tasks
          // in the same phase now have all their dependencies satisfied.
          if (status === 'done' || status === 'skipped') {
            const newlyReady = reevaluateTaskReadiness(taskId, updatedTasks, edges);
            if (newlyReady.length > 0) {
              console.log(`[MissionPlan] ${newlyReady.length} task(s) became ready after ${taskId} completed`);
              
              // Update newly ready tasks locally (DB update happens via separate calls)
              const readyIds = new Set(newlyReady.map((t) => t.id));
              return updatedTasks.map((t) =>
                readyIds.has(t.id) ? { ...t, status: 'ready' as const, updated_at: now } : t
              );
            }
          }
          
          return updatedTasks;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[MissionPlan] Error updating task status:', msg);
        setError(msg);
      }
    },
    [edges]
  );

  // ── Advance Phase ──

  const advancePhase = useCallback(
    async (phaseId: string): Promise<void> => {
      if (!isSupabaseConfigured()) return;
      setError(null);

      try {
        const now = new Date().toISOString();

        // Use planEngine to check if the gate is satisfied and find next phase
        const { nextPhase, completedPhase, readyTasks } = tryActivateNextPhase(phases, tasks, edges);

        // Mark the specified phase as passed (DB uses 'passed'; TS PhaseStatus uses 'completed')
        const { error: phaseErr } = await supabase
          .from('plan_phases')
          .update({ status: 'passed', completed_at: now, updated_at: now })
          .eq('id', phaseId);
        if (phaseErr) throw phaseErr;

        setPhases((prev) =>
          prev.map((p) =>
            p.id === phaseId ? { ...p, status: 'completed', completed_at: now, updated_at: now } : p
          )
        );

        // Determine which next phase to activate
        let targetNextPhase = completedPhase?.id === phaseId ? nextPhase : null;

        // If the engine didn't identify a next phase (e.g. manual_approval gate),
        // find it manually from sorted phases
        if (!targetNextPhase) {
          const sorted = [...phases].sort((a, b) => a.phase_index - b.phase_index);
          const current = sorted.find((p) => p.id === phaseId);
          if (current) {
            targetNextPhase = sorted.find(
              (p) => p.phase_index > current.phase_index && p.status === 'pending'
            ) || null;
          }
        }

        if (!targetNextPhase) return;

        // Activate the next phase
        const { error: nextErr } = await supabase
          .from('plan_phases')
          .update({ status: 'active', started_at: now, updated_at: now })
          .eq('id', targetNextPhase.id);
        if (nextErr) throw nextErr;

        setPhases((prev) =>
          prev.map((p) =>
            p.id === targetNextPhase!.id
              ? { ...p, status: 'active', started_at: now, updated_at: now }
              : p
          )
        );

        // Determine ready tasks: use engine result if the engine found the same next phase,
        // otherwise compute from scratch
        const tasksToReady =
          nextPhase?.id === targetNextPhase.id
            ? readyTasks
            : getReadyTasks(targetNextPhase.id, tasks, edges);

        // Mark ready tasks and inject upstream context
        for (const task of tasksToReady) {
          const ctx = injectUpstreamContext(task, tasks, edges);
          const taskUpdates: Record<string, unknown> = { status: 'ready', updated_at: now };
          if (Object.keys(ctx).length > 0) {
            taskUpdates.input_context = ctx;
          }

          await supabase
            .from('plan_tasks')
            .update(taskUpdates)
            .eq('id', task.id);
        }

        if (tasksToReady.length > 0) {
          const readyIds = new Set(tasksToReady.map((t) => t.id));
          setTasks((prev) =>
            prev.map((t) => {
              if (!readyIds.has(t.id)) return t;
              const ctx = injectUpstreamContext(t, tasks, edges);
              return {
                ...t,
                status: 'ready' as PlanTaskStatus,
                updated_at: now,
                ...(Object.keys(ctx).length > 0 ? { input_context: ctx } : {}),
              };
            })
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[MissionPlan] Error advancing phase:', msg);
        setError(msg);
      }
    },
    [phases, tasks, edges]
  );

  // ── Record Run ──

  const recordRun = useCallback(
    async (
      run: Omit<PlanTaskRun, 'id' | 'created_at' | 'updated_at'>
    ): Promise<PlanTaskRun | null> => {
      if (!isSupabaseConfigured()) return null;
      setError(null);

      try {
        // Map TS PlanTaskRun.phase → DB plan_task_runs.run_type
        const dbRow: Record<string, unknown> = {
          task_id: run.task_id,
          agent_id: run.agent_id,
          status: run.status,
          run_type: run.phase,
          output_text: run.output_text || null,
        };

        if (run.plan_id) dbRow.plan_id = run.plan_id;
        if (run.error_message) dbRow.error_message = run.error_message;
        if (run.started_at) dbRow.started_at = run.started_at;
        if (run.completed_at) dbRow.completed_at = run.completed_at;

        const { data: insertedRun, error: runErr } = await supabase
          .from('plan_task_runs')
          .insert(dbRow)
          .select()
          .single();

        if (runErr) throw runErr;

        const runTs = insertedRun as unknown as PlanTaskRun;
        setRuns((prev) => [runTs, ...prev]);
        return runTs;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[MissionPlan] Error recording run:', msg);
        setError(msg);
        return null;
      }
    },
    []
  );

  return {
    // State
    plan,
    phases,
    tasks,
    edges,
    runs,
    loading,
    error,

    // CRUD
    fetchPlan,
    createPlan,
    approvePlan,
    rejectPlan,
    updateTaskStatus,
    advancePhase,
    recordRun,
  };
}
