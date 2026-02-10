import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ProjectAgentSkill, ProjectSkillType } from '../types/projectAgents';

/**
 * Manages project-scoped skills from the `project_agent_skills` table.
 *
 * - `technology` skills are injected as context instructions (e.g. "use Angular")
 * - `gateway` skills are hot-swapped in the OpenClaw gateway config
 */
export function useProjectSkills(projectId: string | null) {
  const [skills, setSkills] = useState<ProjectAgentSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const subscribedProjectRef = useRef<string | null>(null);

  // ── Fetch + realtime ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured() || !projectId) {
      setSkills([]);
      return;
    }

    if (subscribedProjectRef.current === projectId) return;
    subscribedProjectRef.current = projectId;

    setLoading(true);
    supabase
      .from('project_agent_skills')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProjectSkills] fetch error:', error);
        } else if (data) {
          setSkills(data as ProjectAgentSkill[]);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`project-skills-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_agent_skills' },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row?.project_id !== projectId) return;

          if (payload.eventType === 'INSERT') {
            setSkills((prev) => {
              if (prev.some((s) => s.id === row.id)) return prev;
              return [...prev, row as ProjectAgentSkill];
            });
          } else if (payload.eventType === 'UPDATE') {
            setSkills((prev) =>
              prev.map((s) => (s.id === row.id ? { ...s, ...row } : s))
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              setSkills((prev) => prev.filter((s) => s.id !== oldId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      subscribedProjectRef.current = null;
    };
  }, [projectId]);

  // ── Add skill ───────────────────────────────────────────────────────────

  const addSkill = useCallback(
    async (
      agentId: string,
      skillKey: string,
      skillType: ProjectSkillType = 'technology',
      notes?: string
    ) => {
      if (!isSupabaseConfigured() || !projectId) return false;

      const { error } = await supabase
        .from('project_agent_skills')
        .upsert(
          {
            project_id: projectId,
            agent_id: agentId,
            skill_key: skillKey,
            skill_type: skillType,
            notes: notes ?? null,
          },
          { onConflict: 'project_id,agent_id,skill_key' }
        );

      if (error) {
        console.error('[ProjectSkills] addSkill error:', error);
        return false;
      }
      return true;
    },
    [projectId]
  );

  // ── Remove skill ────────────────────────────────────────────────────────

  const removeSkill = useCallback(
    async (agentId: string, skillKey: string) => {
      if (!isSupabaseConfigured() || !projectId) return false;

      const { error } = await supabase
        .from('project_agent_skills')
        .delete()
        .eq('project_id', projectId)
        .eq('agent_id', agentId)
        .eq('skill_key', skillKey);

      if (error) {
        console.error('[ProjectSkills] removeSkill error:', error);
        return false;
      }
      return true;
    },
    [projectId]
  );

  // ── Bulk set skills for an agent ────────────────────────────────────────

  const bulkSetSkills = useCallback(
    async (agentId: string, newSkills: { key: string; type: ProjectSkillType }[]) => {
      if (!isSupabaseConfigured() || !projectId) return false;

      // Delete existing skills for this agent on this project
      const { error: delError } = await supabase
        .from('project_agent_skills')
        .delete()
        .eq('project_id', projectId)
        .eq('agent_id', agentId);

      if (delError) {
        console.error('[ProjectSkills] bulkSet delete error:', delError);
        return false;
      }

      if (newSkills.length === 0) return true;

      // Insert all new skills
      const rows = newSkills.map((s) => ({
        project_id: projectId,
        agent_id: agentId,
        skill_key: s.key,
        skill_type: s.type,
      }));

      const { error: insError } = await supabase
        .from('project_agent_skills')
        .insert(rows);

      if (insError) {
        console.error('[ProjectSkills] bulkSet insert error:', insError);
        return false;
      }
      return true;
    },
    [projectId]
  );

  // ── Get skills for a specific agent ─────────────────────────────────────

  const getSkillsForAgent = useCallback(
    (agentId: string): { technology: string[]; gateway: string[] } => {
      const agentSkills = skills.filter((s) => s.agent_id === agentId);
      return {
        technology: agentSkills
          .filter((s) => s.skill_type === 'technology')
          .map((s) => s.skill_key),
        gateway: agentSkills
          .filter((s) => s.skill_type === 'gateway')
          .map((s) => s.skill_key),
      };
    },
    [skills]
  );

  return {
    skills,
    loading,
    addSkill,
    removeSkill,
    bulkSetSkills,
    getSkillsForAgent,
  };
}
