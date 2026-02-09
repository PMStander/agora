import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { evaluateLevelUp, evaluateLevelDown } from '../lib/permissions';
import type {
  AgentLevel,
  AgentLevelState,
  AgentGuardrails,
  LevelHistoryEntry,
  LevelTransitionRequest,
  LevelMetricsSnapshot,
  GuardrailViolation,
  GuardrailViolationSeverity,
  GuardrailResolution,
  PermissionAction,
  LevelTransitionTrigger,
} from '../types/supabase';

// ─── Default values ─────────────────────────────────────────────────────────

const DEFAULT_GUARDRAILS: AgentGuardrails = {
  allowed_domains: [],
  allowed_actions: [],
  denied_actions: [],
  max_concurrent_missions: 1,
  max_daily_tasks: 5,
  escalation_agent_id: null,
  auto_review_threshold: 0.7,
};

const DEFAULT_METRICS: LevelMetricsSnapshot = {
  tasks_completed: 0,
  avg_review_score: 0,
  violations_30d: 0,
  critical_violations_7d: 0,
  consecutive_failures: 0,
  time_in_level_days: 0,
};

function buildAgentLevelState(row: Record<string, unknown>): AgentLevelState {
  return {
    agent_id: row.agent_id as string,
    current_level: (row.current_level as AgentLevel) || 1,
    guardrails: (row.guardrails as AgentGuardrails) || DEFAULT_GUARDRAILS,
    metrics: (row.metrics as LevelMetricsSnapshot) || DEFAULT_METRICS,
    level_history: [],
    pending_transition: null,
    level_assigned_at: (row.level_assigned_at as string) || new Date().toISOString(),
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAgentLevel() {
  const [agentLevels, setAgentLevels] = useState<Record<string, AgentLevelState>>({});
  const [violations, setViolations] = useState<GuardrailViolation[]>([]);
  const [pendingTransitions, setPendingTransitions] = useState<LevelTransitionRequest[]>([]);
  const [levelHistory, setLevelHistory] = useState<Record<string, LevelHistoryEntry[]>>({});
  const initializedRef = useRef(false);

  // ── Fetch all agent levels ────────────────────────────────────────────
  const fetchAgentLevels = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('agent_levels')
      .select('*');

    if (error) {
      console.error('[AgentLevel] Error fetching agent levels:', error);
      return;
    }

    if (data) {
      const levels: Record<string, AgentLevelState> = {};
      for (const row of data) {
        levels[row.agent_id] = buildAgentLevelState(row);
      }
      setAgentLevels(levels);
    }
  }, []);

  // ── Get single agent level ────────────────────────────────────────────
  const getAgentLevel = useCallback(
    (agentId: string): AgentLevelState | null => {
      return agentLevels[agentId] || null;
    },
    [agentLevels],
  );

  // ── Get numeric level (convenience) ───────────────────────────────────
  const getLevel = useCallback(
    (agentId: string): AgentLevel => {
      return agentLevels[agentId]?.current_level || 1;
    },
    [agentLevels],
  );

  // ── Get guardrails ───────────────────────────────────────────────────
  const getGuardrails = useCallback(
    (agentId: string): AgentGuardrails => {
      return agentLevels[agentId]?.guardrails || DEFAULT_GUARDRAILS;
    },
    [agentLevels],
  );

  // ── Set agent level ──────────────────────────────────────────────────
  const setAgentLevel = useCallback(
    async (
      agentId: string,
      level: AgentLevel,
      trigger: LevelTransitionTrigger,
      reason: string,
    ) => {
      const current = agentLevels[agentId];
      const fromLevel = current?.current_level || 1;
      const metrics = current?.metrics || DEFAULT_METRICS;
      const now = new Date().toISOString();

      // Update agent_levels table
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('agent_levels')
          .upsert({
            agent_id: agentId,
            current_level: level,
            level_assigned_at: now,
            updated_at: now,
          });

        if (error) {
          console.error('[AgentLevel] Error setting level:', error);
          return;
        }

        // Insert history entry
        await supabase.from('agent_level_history').insert({
          agent_id: agentId,
          from_level: fromLevel,
          to_level: level,
          trigger,
          reason,
          approved_by: trigger === 'demotion' ? 'system' : 'human',
          metrics_snapshot: metrics,
        });
      }

      // Update local state
      setAgentLevels((prev) => ({
        ...prev,
        [agentId]: {
          ...(prev[agentId] || buildAgentLevelState({ agent_id: agentId })),
          current_level: level,
          level_assigned_at: now,
          updated_at: now,
        },
      }));
    },
    [agentLevels],
  );

  // ── Update guardrails ────────────────────────────────────────────────
  const updateGuardrails = useCallback(
    async (agentId: string, guardrails: AgentGuardrails) => {
      const now = new Date().toISOString();

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('agent_levels')
          .update({ guardrails, updated_at: now })
          .eq('agent_id', agentId);

        if (error) {
          console.error('[AgentLevel] Error updating guardrails:', error);
          return;
        }
      }

      setAgentLevels((prev) => ({
        ...prev,
        [agentId]: {
          ...(prev[agentId] || buildAgentLevelState({ agent_id: agentId })),
          guardrails,
          updated_at: now,
        },
      }));
    },
    [],
  );

  // ── Request promotion ────────────────────────────────────────────────
  const requestPromotion = useCallback(
    async (agentId: string) => {
      const current = agentLevels[agentId];
      if (!current || current.current_level >= 4) return;

      const metrics = current.metrics || DEFAULT_METRICS;
      const evaluation = evaluateLevelUp(agentId, metrics, current.current_level);
      if (!evaluation.eligible) {
        console.warn('[AgentLevel] Promotion not eligible:', evaluation.reason);
        return;
      }

      const toLevel = (current.current_level + 1) as AgentLevel;

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('agent_level_transitions')
          .insert({
            agent_id: agentId,
            from_level: current.current_level,
            to_level: toLevel,
            trigger: 'promotion',
            reason: evaluation.reason,
            metrics_snapshot: metrics,
            status: 'pending',
          })
          .select()
          .single();

        if (error) {
          console.error('[AgentLevel] Error requesting promotion:', error);
          return;
        }

        if (data) {
          setPendingTransitions((prev) => [data as LevelTransitionRequest, ...prev]);
        }
      }
    },
    [agentLevels],
  );

  // ── Approve transition ───────────────────────────────────────────────
  const approveTransition = useCallback(
    async (transitionId: string) => {
      const transition = pendingTransitions.find((t) => t.id === transitionId);
      if (!transition) return;

      const now = new Date().toISOString();

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('agent_level_transitions')
          .update({ status: 'approved', reviewed_by: 'human', reviewed_at: now })
          .eq('id', transitionId);

        if (error) {
          console.error('[AgentLevel] Error approving transition:', error);
          return;
        }
      }

      // Apply the level change
      await setAgentLevel(
        transition.agent_id,
        transition.to_level,
        transition.trigger,
        transition.reason,
      );

      setPendingTransitions((prev) =>
        prev.map((t) =>
          t.id === transitionId
            ? { ...t, status: 'approved' as const, reviewed_by: 'human', reviewed_at: now }
            : t,
        ),
      );
    },
    [pendingTransitions, setAgentLevel],
  );

  // ── Reject transition ────────────────────────────────────────────────
  const rejectTransition = useCallback(
    async (transitionId: string) => {
      const now = new Date().toISOString();
      const cooldownUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('agent_level_transitions')
          .update({
            status: 'rejected',
            reviewed_by: 'human',
            reviewed_at: now,
            cooldown_until: cooldownUntil,
          })
          .eq('id', transitionId);

        if (error) {
          console.error('[AgentLevel] Error rejecting transition:', error);
          return;
        }
      }

      setPendingTransitions((prev) =>
        prev.map((t) =>
          t.id === transitionId
            ? {
                ...t,
                status: 'rejected' as const,
                reviewed_by: 'human',
                reviewed_at: now,
                cooldown_until: cooldownUntil,
              }
            : t,
        ),
      );
    },
    [],
  );

  // ── Fetch level history for agent ────────────────────────────────────
  const fetchLevelHistory = useCallback(async (agentId: string) => {
    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('agent_level_history')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AgentLevel] Error fetching history:', error);
      return;
    }

    if (data) {
      setLevelHistory((prev) => ({
        ...prev,
        [agentId]: data as LevelHistoryEntry[],
      }));
    }
  }, []);

  // ── Fetch violations ─────────────────────────────────────────────────
  const fetchViolations = useCallback(async (agentId?: string) => {
    if (!isSupabaseConfigured()) return;

    let query = supabase
      .from('guardrail_violations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AgentLevel] Error fetching violations:', error);
      return;
    }

    if (data) {
      setViolations(data as GuardrailViolation[]);
    }
  }, []);

  // ── Log violation ────────────────────────────────────────────────────
  const logViolation = useCallback(
    async (
      agentId: string,
      action: PermissionAction,
      guardrail: string,
      severity: GuardrailViolationSeverity,
      resolution: GuardrailResolution = 'auto_denied',
      context: Record<string, unknown> = {},
    ) => {
      if (!isSupabaseConfigured()) return;

      const { data, error } = await supabase
        .from('guardrail_violations')
        .insert({
          agent_id: agentId,
          action_attempted: action,
          guardrail_violated: guardrail,
          severity,
          resolution,
          context,
        })
        .select()
        .single();

      if (error) {
        console.error('[AgentLevel] Error logging violation:', error);
        return;
      }

      if (data) {
        setViolations((prev) => [data as GuardrailViolation, ...prev].slice(0, 200));
      }
    },
    [],
  );

  // ── Fetch pending transitions ────────────────────────────────────────
  const fetchPendingTransitions = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { data, error } = await supabase
      .from('agent_level_transitions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AgentLevel] Error fetching transitions:', error);
      return;
    }

    if (data) {
      setPendingTransitions(data as LevelTransitionRequest[]);
    }
  }, []);

  // ── Check and evaluate transitions for all agents ────────────────────
  const checkAndEvaluateTransitions = useCallback(async () => {
    for (const [agentId, state] of Object.entries(agentLevels)) {
      const metrics = state.metrics;
      if (!metrics) continue;

      // Check for demotion first
      const demotion = evaluateLevelDown(agentId, metrics, state.current_level);
      if (demotion.shouldDemote && demotion.targetLevel) {
        await setAgentLevel(agentId, demotion.targetLevel, 'demotion', demotion.reason);
        continue;
      }

      // Check for promotion eligibility
      const promotion = evaluateLevelUp(agentId, metrics, state.current_level);
      if (promotion.eligible) {
        // Check if there's already a pending transition
        const hasPending = pendingTransitions.some(
          (t) => t.agent_id === agentId && t.status === 'pending',
        );
        if (!hasPending) {
          await requestPromotion(agentId);
        }
      }
    }
  }, [agentLevels, pendingTransitions, requestPromotion, setAgentLevel]);

  // ── Initial fetch + realtime subscriptions ───────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!isSupabaseConfigured()) return;

    fetchAgentLevels();
    fetchViolations();
    fetchPendingTransitions();

    // Realtime: agent_levels changes
    const levelsChannel = supabase
      .channel('agent-levels-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_levels' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            setAgentLevels((prev) => ({
              ...prev,
              [row.agent_id]: buildAgentLevelState(row),
            }));
          } else if (payload.eventType === 'DELETE') {
            const agentId = (payload.old as Record<string, unknown>).agent_id as string;
            setAgentLevels((prev) => {
              const next = { ...prev };
              delete next[agentId];
              return next;
            });
          }
        },
      )
      .subscribe();

    // Realtime: guardrail_violations
    const violationsChannel = supabase
      .channel('guardrail-violations-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guardrail_violations' },
        (payload) => {
          const violation = payload.new as GuardrailViolation;
          setViolations((prev) => [violation, ...prev].slice(0, 200));
        },
      )
      .subscribe();

    // Realtime: agent_level_transitions
    const transitionsChannel = supabase
      .channel('agent-level-transitions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_level_transitions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const transition = payload.new as LevelTransitionRequest;
            if (transition.status === 'pending') {
              setPendingTransitions((prev) => [transition, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const transition = payload.new as LevelTransitionRequest;
            setPendingTransitions((prev) =>
              prev.map((t) => (t.id === transition.id ? transition : t)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      levelsChannel.unsubscribe();
      violationsChannel.unsubscribe();
      transitionsChannel.unsubscribe();
      initializedRef.current = false;
    };
  }, [fetchAgentLevels, fetchPendingTransitions, fetchViolations]);

  return {
    agentLevels,
    violations,
    pendingTransitions,
    levelHistory,
    getAgentLevel,
    getLevel,
    getGuardrails,
    setAgentLevel,
    updateGuardrails,
    requestPromotion,
    approveTransition,
    rejectTransition,
    fetchLevelHistory,
    fetchViolations,
    logViolation,
    checkAndEvaluateTransitions,
  };
}
