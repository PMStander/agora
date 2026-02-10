import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ProjectAgentAssignment, ProjectAgentRole } from '../types/projectAgents';

/**
 * Manages multi-agent assignment for a project using the existing
 * `crm_agent_assignments` table with `entity_type = 'project'`.
 */
export function useProjectAgents(projectId: string | null) {
  const [assignments, setAssignments] = useState<ProjectAgentAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const subscribedProjectRef = useRef<string | null>(null);

  // ── Fetch + realtime ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured() || !projectId) {
      setAssignments([]);
      return;
    }

    // Avoid re-subscribing to the same project
    if (subscribedProjectRef.current === projectId) return;
    subscribedProjectRef.current = projectId;

    setLoading(true);
    supabase
      .from('crm_agent_assignments')
      .select('*')
      .eq('entity_type', 'project')
      .eq('entity_id', projectId)
      .order('assigned_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('[ProjectAgents] fetch error:', error);
        } else if (data) {
          setAssignments(data as ProjectAgentAssignment[]);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`project-agents-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_agent_assignments' },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          // Only handle events for this project
          if (row?.entity_type !== 'project' || row?.entity_id !== projectId) return;

          if (payload.eventType === 'INSERT') {
            setAssignments((prev) => {
              if (prev.some((a) => a.id === row.id)) return prev;
              return [...prev, row as ProjectAgentAssignment];
            });
          } else if (payload.eventType === 'UPDATE') {
            setAssignments((prev) =>
              prev.map((a) => (a.id === row.id ? { ...a, ...row } : a))
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              setAssignments((prev) => prev.filter((a) => a.id !== oldId));
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

  // ── Assign agent ────────────────────────────────────────────────────────

  const assignAgent = useCallback(
    async (agentId: string, role: ProjectAgentRole = 'collaborator') => {
      if (!isSupabaseConfigured() || !projectId) return false;

      const { error } = await supabase
        .from('crm_agent_assignments')
        .upsert(
          {
            agent_id: agentId,
            entity_type: 'project',
            entity_id: projectId,
            role,
          },
          { onConflict: 'agent_id,entity_type,entity_id' }
        );

      if (error) {
        console.error('[ProjectAgents] assign error:', error);
        return false;
      }

      // Auto-grant context_access for the project's context
      await autoGrantContextAccess(projectId, agentId, role);
      return true;
    },
    [projectId]
  );

  // ── Remove agent ────────────────────────────────────────────────────────

  const removeAgent = useCallback(
    async (agentId: string) => {
      if (!isSupabaseConfigured() || !projectId) return false;

      const { error } = await supabase
        .from('crm_agent_assignments')
        .delete()
        .eq('agent_id', agentId)
        .eq('entity_type', 'project')
        .eq('entity_id', projectId);

      if (error) {
        console.error('[ProjectAgents] remove error:', error);
        return false;
      }

      // Also remove project-scoped skills for this agent
      await supabase
        .from('project_agent_skills')
        .delete()
        .eq('project_id', projectId)
        .eq('agent_id', agentId);

      // Revoke context_access
      await revokeContextAccess(projectId, agentId);
      return true;
    },
    [projectId]
  );

  // ── Update role ─────────────────────────────────────────────────────────

  const updateRole = useCallback(
    async (agentId: string, role: ProjectAgentRole) => {
      if (!isSupabaseConfigured() || !projectId) return false;

      const { error } = await supabase
        .from('crm_agent_assignments')
        .update({ role })
        .eq('agent_id', agentId)
        .eq('entity_type', 'project')
        .eq('entity_id', projectId);

      if (error) {
        console.error('[ProjectAgents] updateRole error:', error);
        return false;
      }

      // Update context_access level to match
      const accessLevel = role === 'watcher' ? 'read' : 'write';
      await autoGrantContextAccess(projectId, agentId, role, accessLevel);
      return true;
    },
    [projectId]
  );

  return { assignments, loading, assignAgent, removeAgent, updateRole };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function autoGrantContextAccess(
  projectId: string,
  agentId: string,
  role: ProjectAgentRole,
  accessLevel?: string
) {
  const level = accessLevel ?? (role === 'watcher' ? 'read' : 'write');

  // Find the project_context for this project
  const { data: ctx } = await supabase
    .from('project_contexts')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle();

  if (!ctx) return; // No context exists yet — will be granted when context is created

  await supabase.from('context_access').upsert(
    {
      project_context_id: ctx.id,
      agent_id: agentId,
      access_level: level,
      granted_by: 'system',
    },
    { onConflict: 'project_context_id,agent_id' }
  );
}

async function revokeContextAccess(projectId: string, agentId: string) {
  const { data: ctx } = await supabase
    .from('project_contexts')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle();

  if (!ctx) return;

  await supabase
    .from('context_access')
    .delete()
    .eq('project_context_id', ctx.id)
    .eq('agent_id', agentId);
}
