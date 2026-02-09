import { useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useContextStore } from '../stores/context';
import { useMissionControlStore } from '../stores/missionControl';
import type { HandoffRequest } from '../types/context';

export function useHandoff() {
  const {
    handoffRequests,
    setHandoffRequests,
    addHandoffRequest,
    updateHandoffRequest,
  } = useContextStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime ──────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    supabase
      .from('handoff_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error('[Handoff] fetch error:', error);
        else if (data) setHandoffRequests(data as HandoffRequest[]);
      });

    const channel = supabase
      .channel('handoff-requests-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handoff_requests' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            addHandoffRequest(payload.new as HandoffRequest);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as HandoffRequest;
            updateHandoffRequest(updated.id, updated);
          } else if (payload.eventType === 'DELETE') {
            useContextStore.getState().removeHandoffRequest(String(payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [addHandoffRequest, setHandoffRequests, updateHandoffRequest]);

  // ── Create handoff ────────────────────────────────────────────────────
  const createHandoff = useCallback(
    async (request: Omit<HandoffRequest, 'id' | 'created_at' | 'updated_at' | 'status' | 'accepted_at' | 'completed_at' | 'outcome' | 'time_taken_minutes'>) => {
      if (!isSupabaseConfigured()) return null;

      const { data, error } = await supabase
        .from('handoff_requests')
        .insert({
          requesting_agent_id: request.requesting_agent_id,
          target_agent_id: request.target_agent_id,
          task_id: request.task_id,
          mission_id: request.mission_id,
          reason: request.reason,
          context_summary: request.context_summary,
          priority: request.priority,
          status: 'requested',
        })
        .select()
        .single();

      if (error) {
        console.error('[Handoff] create error:', error);
        return null;
      }

      const handoff = data as HandoffRequest;
      addHandoffRequest(handoff);

      // Emit activity
      useMissionControlStore.getState().addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'handoff_requested',
        message: `Handoff requested: ${request.reason}`,
        agent: null,
        created_at: new Date().toISOString(),
      });

      return handoff;
    },
    [addHandoffRequest]
  );

  // ── Accept handoff ────────────────────────────────────────────────────
  const acceptHandoff = useCallback(
    async (handoffId: string) => {
      if (!isSupabaseConfigured()) return false;

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('handoff_requests')
        .update({ status: 'accepted', accepted_at: now, updated_at: now })
        .eq('id', handoffId);

      if (error) {
        console.error('[Handoff] accept error:', error);
        return false;
      }

      updateHandoffRequest(handoffId, { status: 'accepted', accepted_at: now });
      return true;
    },
    [updateHandoffRequest]
  );

  // ── Complete handoff ──────────────────────────────────────────────────
  const completeHandoff = useCallback(
    async (handoffId: string, outcome: string, timeTakenMinutes?: number) => {
      if (!isSupabaseConfigured()) return false;

      const now = new Date().toISOString();
      const updates: Record<string, any> = {
        status: 'completed',
        outcome,
        completed_at: now,
        updated_at: now,
      };
      if (timeTakenMinutes !== undefined) {
        updates.time_taken_minutes = timeTakenMinutes;
      }

      const { error } = await supabase
        .from('handoff_requests')
        .update(updates)
        .eq('id', handoffId);

      if (error) {
        console.error('[Handoff] complete error:', error);
        return false;
      }

      updateHandoffRequest(handoffId, {
        status: 'completed',
        outcome,
        completed_at: now,
        time_taken_minutes: timeTakenMinutes ?? null,
      });

      useMissionControlStore.getState().addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'handoff_completed',
        message: `Handoff completed: ${outcome.slice(0, 80)}`,
        agent: null,
        created_at: now,
      });

      return true;
    },
    [updateHandoffRequest]
  );

  // ── Decline handoff ───────────────────────────────────────────────────
  const declineHandoff = useCallback(
    async (handoffId: string, reason: string) => {
      if (!isSupabaseConfigured()) return false;

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('handoff_requests')
        .update({ status: 'declined', outcome: reason, updated_at: now })
        .eq('id', handoffId);

      if (error) {
        console.error('[Handoff] decline error:', error);
        return false;
      }

      updateHandoffRequest(handoffId, { status: 'declined', outcome: reason });
      return true;
    },
    [updateHandoffRequest]
  );

  // ── Get active handoffs for an agent ──────────────────────────────────
  const getActiveHandoffs = useCallback(
    (agentId: string) =>
      handoffRequests.filter(
        (r) =>
          (r.requesting_agent_id === agentId || r.target_agent_id === agentId) &&
          (r.status === 'requested' || r.status === 'accepted' || r.status === 'in_progress')
      ),
    [handoffRequests]
  );

  // ── Get handoff history for an agent ──────────────────────────────────
  const getHandoffHistory = useCallback(
    (agentId: string) =>
      handoffRequests.filter(
        (r) =>
          r.requesting_agent_id === agentId || r.target_agent_id === agentId
      ),
    [handoffRequests]
  );

  return {
    handoffRequests,
    createHandoff,
    acceptHandoff,
    completeHandoff,
    declineHandoff,
    getActiveHandoffs,
    getHandoffHistory,
  };
}
