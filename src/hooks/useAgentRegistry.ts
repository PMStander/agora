import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AgentRegistryEntry } from '../types/context';

export function useAgentRegistry() {
  const [agents, setAgents] = useState<AgentRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  // ── Initial fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    supabase
      .from('agents')
      .select(
        'id, display_name, role, team_id, domains, skills, availability, current_task_id, current_mission_id, level, total_missions_completed, avg_quality_score, response_time_avg_minutes, last_active_at'
      )
      .then(({ data, error }) => {
        if (error) {
          console.error('[AgentRegistry] fetch error:', error);
        } else if (data) {
          setAgents(
            data.map((row: any) => ({
              agent_id: row.id,
              display_name: row.display_name || row.id,
              role: row.role || '',
              team_id: row.team_id || '',
              domains: row.domains || [],
              skills: row.skills || [],
              availability: row.availability || 'offline',
              current_task_id: row.current_task_id || null,
              current_mission_id: row.current_mission_id || null,
              level: row.level || 1,
              total_missions_completed: row.total_missions_completed || 0,
              avg_quality_score: row.avg_quality_score || 0,
              response_time_avg_minutes: row.response_time_avg_minutes || 0,
              last_active_at: row.last_active_at || '',
            }))
          );
        }
        setLoading(false);
      });
  }, []);

  // ── Find expert by domain/skill ───────────────────────────────────────
  const findExpert = useCallback(
    async (query: {
      domain?: string;
      skill?: string;
    }): Promise<AgentRegistryEntry[]> => {
      if (!isSupabaseConfigured()) return [];

      let q = supabase
        .from('agents')
        .select('*')
        .order('avg_quality_score', { ascending: false })
        .order('level', { ascending: false })
        .limit(5);

      if (query.domain) {
        q = q.contains('domains', [query.domain]);
      }
      if (query.skill) {
        q = q.contains('skills', [query.skill]);
      }

      const { data, error } = await q;
      if (error) {
        console.error('[AgentRegistry] findExpert error:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        agent_id: row.id,
        display_name: row.display_name || row.id,
        role: row.role || '',
        team_id: row.team_id || '',
        domains: row.domains || [],
        skills: row.skills || [],
        availability: row.availability || 'offline',
        current_task_id: row.current_task_id || null,
        current_mission_id: row.current_mission_id || null,
        level: row.level || 1,
        total_missions_completed: row.total_missions_completed || 0,
        avg_quality_score: row.avg_quality_score || 0,
        response_time_avg_minutes: row.response_time_avg_minutes || 0,
        last_active_at: row.last_active_at || '',
      }));
    },
    []
  );

  // ── Update availability ───────────────────────────────────────────────
  const updateAvailability = useCallback(
    async (agentId: string, availability: 'available' | 'busy' | 'offline') => {
      if (!isSupabaseConfigured()) return false;

      const { error } = await supabase
        .from('agents')
        .update({ availability, last_active_at: new Date().toISOString() })
        .eq('id', agentId);

      if (error) {
        console.error('[AgentRegistry] updateAvailability error:', error);
        return false;
      }

      setAgents((prev) =>
        prev.map((a) =>
          a.agent_id === agentId ? { ...a, availability } : a
        )
      );
      return true;
    },
    []
  );

  // ── Get agent profile ─────────────────────────────────────────────────
  const getAgentProfile = useCallback(
    async (agentId: string) => {
      if (!isSupabaseConfigured()) return null;

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        agent_id: data.id,
        display_name: data.display_name || data.id,
        role: data.role || '',
        team_id: data.team_id || '',
        domains: data.domains || [],
        skills: data.skills || [],
        availability: data.availability || 'offline',
        current_task_id: data.current_task_id || null,
        current_mission_id: data.current_mission_id || null,
        level: data.level || 1,
        total_missions_completed: data.total_missions_completed || 0,
        avg_quality_score: data.avg_quality_score || 0,
        response_time_avg_minutes: data.response_time_avg_minutes || 0,
        last_active_at: data.last_active_at || '',
      } as AgentRegistryEntry;
    },
    []
  );

  return {
    agents,
    loading,
    findExpert,
    updateAvailability,
    getAgentProfile,
  };
}
