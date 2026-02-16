import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import { createNotificationDirect } from './useNotifications';
import type { AgentReflection, EvolutionReport } from '../types/growth';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAgentGrowth() {
  const initializedRef = useRef(false);
  const [reflections, setReflections] = useState<AgentReflection[]>([]);
  const [reports, setReports] = useState<EvolutionReport[]>([]);
  const [loadingReflections, setLoadingReflections] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  // ── Reflection CRUD helpers for realtime ──
  const addReflectionToState = useCallback((r: AgentReflection) => {
    setReflections((prev) => {
      if (prev.some((x) => x.id === r.id)) return prev;
      return [r, ...prev];
    });
  }, []);

  const updateReflectionInState = useCallback((id: string, updates: Partial<AgentReflection>) => {
    setReflections((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  const removeReflectionFromState = useCallback((id: string) => {
    setReflections((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Report CRUD helpers for realtime ──
  const addReportToState = useCallback((r: EvolutionReport) => {
    setReports((prev) => {
      if (prev.some((x) => x.id === r.id)) return prev;
      return [r, ...prev];
    });
  }, []);

  const updateReportInState = useCallback((id: string, updates: Partial<EvolutionReport>) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  const removeReportFromState = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch reflections
    supabase
      .from('agent_reflections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data) setReflections(data as AgentReflection[]);
        setLoadingReflections(false);
      });

    // Fetch reports
    supabase
      .from('evolution_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setReports(data as EvolutionReport[]);
        setLoadingReports(false);
      });

    // Realtime: reflections
    const reflSub = supabase
      .channel('agent-reflections-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_reflections' },
        (payload) => {
          handleRealtimePayload<AgentReflection>(
            payload as unknown as { eventType: string; new: AgentReflection; old: AgentReflection },
            addReflectionToState,
            updateReflectionInState,
            removeReflectionFromState
          );
        }
      )
      .subscribe();

    // Realtime: reports
    const reportSub = supabase
      .channel('evolution-reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evolution_reports' },
        (payload) => {
          handleRealtimePayload<EvolutionReport>(
            payload as unknown as { eventType: string; new: EvolutionReport; old: EvolutionReport },
            addReportToState,
            updateReportInState,
            removeReportFromState
          );
        }
      )
      .subscribe();

    return () => {
      reflSub.unsubscribe();
      reportSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Queries ──

  const getReflectionsForAgent = useCallback(
    (agentId: string) => reflections.filter((r) => r.agent_id === agentId),
    [reflections]
  );

  const getReportsForAgent = useCallback(
    (agentId: string | null) =>
      agentId
        ? reports.filter((r) => r.agent_id === agentId || r.report_type === 'team')
        : reports.filter((r) => r.report_type === 'team'),
    [reports]
  );

  const getGrowthStats = useCallback(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const recent = reflections.filter((r) => new Date(r.created_at).getTime() > dayAgo);

    const sentimentMap: Record<string, number> = { positive: 1, neutral: 0.5, negative: 0, mixed: 0.5 };
    const avgSentiment =
      reflections.length > 0
        ? reflections.reduce((sum, r) => sum + (sentimentMap[r.sentiment] ?? 0.5), 0) / reflections.length
        : 0.5;

    return {
      totalReflections: reflections.length,
      recentReflections24h: recent.length,
      totalReports: reports.length,
      averageSentiment: Math.round(avgSentiment * 100) / 100,
    };
  }, [reflections, reports]);

  // ── Mutations ──

  const addReflection = useCallback(
    async (data: Omit<AgentReflection, 'id' | 'created_at'>) => {
      const { data: row, error } = await supabase
        .from('agent_reflections')
        .insert(data)
        .select()
        .single();

      if (error) {
        console.error('[AgentGrowth] Error creating reflection:', error);
        return null;
      }

      const reflection = row as AgentReflection;

      // Notification for this reflection
      await createNotificationDirect(
        'agent_reflection',
        `${data.agent_id} reflected on: ${data.tags[0] || 'general'}`,
        data.content.slice(0, 200),
        'agent',
        data.agent_id,
        data.agent_id,
        'info'
      );

      // Pattern detection: 3+ same tag in 24h
      checkForPatterns(reflection);

      return reflection;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reflections]
  );

  const checkForPatterns = useCallback(
    (newReflection: AgentReflection) => {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const agentRecent = reflections.filter(
        (r) => r.agent_id === newReflection.agent_id && new Date(r.created_at).getTime() > dayAgo
      );

      // Count tag frequencies across recent reflections including the new one
      const allRecent = [...agentRecent, newReflection];
      const tagCounts: Record<string, number> = {};
      for (const r of allRecent) {
        for (const tag of r.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      // Fire warning for any tag appearing 3+ times
      for (const [tag, count] of Object.entries(tagCounts)) {
        if (count >= 3) {
          createNotificationDirect(
            'reflection_pattern',
            `Pattern: ${newReflection.agent_id} keeps reflecting on "${tag}"`,
            `This agent has reflected on "${tag}" ${count} times in the last 24 hours. Consider reviewing.`,
            'agent',
            newReflection.agent_id,
            newReflection.agent_id,
            'warning'
          );
          break; // One notification per reflection insert
        }
      }
    },
    [reflections]
  );

  const triggerEvolutionReport = useCallback(
    async (data: {
      agent_id: string | null;
      report_type: 'individual' | 'team';
      period_start: string;
      period_end: string;
    }) => {
      const { data: row, error } = await supabase
        .from('evolution_reports')
        .insert({
          ...data,
          status: 'pending',
          triggered_by: 'manual',
          signals: [],
          recommendations: [],
          health_summary: { overall_score: 0, top_strengths: [], top_concerns: [], reflection_count: 0, avg_sentiment_score: 0 },
        })
        .select()
        .single();

      if (error) {
        console.error('[AgentGrowth] Error creating evolution report:', error);
        return null;
      }

      return row as EvolutionReport;
    },
    []
  );

  return {
    reflections,
    reports,
    loadingReflections,
    loadingReports,
    getReflectionsForAgent,
    getReportsForAgent,
    addReflection,
    triggerEvolutionReport,
    getGrowthStats,
  };
}
