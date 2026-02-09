import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useProjectsStore, type Project, type ProjectStatus } from '../stores/projects';
import { useMissionControlStore } from '../stores/missionControl';
import { handleRealtimePayload } from '../lib/realtimeHelpers';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useProjects() {
  const store = useProjectsStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch projects with their linked mission IDs
    supabase
      .from('projects')
      .select('*, project_missions(mission_id)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          store.setProjects(
            data.map((p: any) => ({
              ...p,
              mission_ids: (p.project_missions || []).map((pm: any) => pm.mission_id),
            })) as Project[]
          );
        }
      });

    // Realtime subscriptions
    const projectsSub = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) =>
          handleRealtimePayload<Project>(
            payload,
            store.addProject,
            store.updateProject,
            store.removeProject
          )
      )
      .subscribe();

    return () => {
      projectsSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CRUD ──

  const createProject = useCallback(
    async (data: {
      name: string;
      description?: string;
      status?: ProjectStatus;
      deal_id?: string;
      contact_id?: string;
      company_id?: string;
      owner_agent_id?: string;
      budget?: number;
      currency?: string;
      start_date?: string;
      target_end_date?: string;
      tags?: string[];
    }) => {
      const { data: project, error } = await supabase
        .from('projects')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[Projects] Error creating project:', error);
        return null;
      }
      const enriched = { ...project, mission_ids: [] } as Project;
      store.addProject(enriched);
      return enriched;
    },
    [store]
  );

  const updateProjectDetails = useCallback(
    async (projectId: string, updates: Partial<Project>) => {
      const { error } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId);
      if (error) {
        console.error('[Projects] Error updating project:', error);
        return;
      }
      store.updateProject(projectId, updates);
    },
    [store]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      if (error) {
        console.error('[Projects] Error deleting project:', error);
        return;
      }
      store.removeProject(projectId);
    },
    [store]
  );

  const linkMissionToProject = useCallback(
    async (projectId: string, missionId: string) => {
      const { error } = await supabase
        .from('project_missions')
        .insert({ project_id: projectId, mission_id: missionId });
      if (error) {
        console.error('[Projects] Error linking mission:', error);
        return;
      }
      // Update local state
      const project = store.projects.find((p) => p.id === projectId);
      if (project) {
        const missionIds = [...(project.mission_ids || []), missionId];
        store.updateProject(projectId, { mission_ids: missionIds } as Partial<Project>);
      }
    },
    [store]
  );

  const unlinkMission = useCallback(
    async (projectId: string, missionId: string) => {
      const { error } = await supabase
        .from('project_missions')
        .delete()
        .eq('project_id', projectId)
        .eq('mission_id', missionId);
      if (error) {
        console.error('[Projects] Error unlinking mission:', error);
        return;
      }
      const project = store.projects.find((p) => p.id === projectId);
      if (project) {
        const missionIds = (project.mission_ids || []).filter((id) => id !== missionId);
        store.updateProject(projectId, { mission_ids: missionIds } as Partial<Project>);
      }
    },
    [store]
  );

  /** Compute project progress from linked missions */
  const getProjectProgress = useCallback(
    (projectId: string): { total: number; completed: number; percent: number } => {
      const project = store.projects.find((p) => p.id === projectId);
      const missionIds = project?.mission_ids || [];
      if (missionIds.length === 0) return { total: 0, completed: 0, percent: 0 };

      const missions = useMissionControlStore.getState().missions;
      const linked = missions.filter((m) => missionIds.includes(m.id));
      const completed = linked.filter(
        (m) => m.status === 'done' || m.mission_status === 'done'
      ).length;

      return {
        total: linked.length,
        completed,
        percent: linked.length > 0 ? Math.round((completed / linked.length) * 100) : 0,
      };
    },
    [store.projects]
  );

  return {
    projects: store.projects,
    createProject,
    updateProjectDetails,
    deleteProject,
    linkMissionToProject,
    unlinkMission,
    getProjectProgress,
    isConfigured: isSupabaseConfigured(),
  };
}
