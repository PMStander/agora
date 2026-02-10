import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ProjectCodebase, CodebaseSourceType } from '../types/projectCodebases';

/**
 * Manages linked codebases for a project.
 * Pattern: same as useProjectAgents (useRef init guard, realtime, CRUD).
 */
export function useProjectCodebases(projectId: string | null) {
  const [codebases, setCodebases] = useState<ProjectCodebase[]>([]);
  const [loading, setLoading] = useState(false);
  const subscribedProjectRef = useRef<string | null>(null);

  // ── Fetch + realtime ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured() || !projectId) {
      setCodebases([]);
      return;
    }

    if (subscribedProjectRef.current === projectId) return;
    subscribedProjectRef.current = projectId;

    setLoading(true);
    supabase
      .from('project_codebases')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[ProjectCodebases] fetch error:', error);
        else setCodebases((data || []) as ProjectCodebase[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`project-codebases-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_codebases',
        },
        (payload) => {
          const row = (payload.new || payload.old) as ProjectCodebase;
          // Client-side filter to this project
          if (payload.eventType === 'INSERT') {
            if (row.project_id === projectId) {
              setCodebases((prev) => {
                if (prev.some((c) => c.id === row.id)) return prev;
                return [row, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            if (row.project_id === projectId) {
              setCodebases((prev) =>
                prev.map((c) => (c.id === row.id ? { ...c, ...row } : c))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setCodebases((prev) => prev.filter((c) => c.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      subscribedProjectRef.current = null;
    };
  }, [projectId]);

  // ── CRUD ────────────────────────────────────────────────────────────────

  const addCodebase = useCallback(
    async (data: {
      name: string;
      source_type: CodebaseSourceType;
      path: string;
      branch?: string;
      description?: string;
    }) => {
      if (!isSupabaseConfigured() || !projectId) return null;

      const { data: row, error } = await supabase
        .from('project_codebases')
        .insert({
          project_id: projectId,
          name: data.name,
          source_type: data.source_type,
          path: data.path,
          branch: data.branch || null,
          description: data.description || null,
        })
        .select()
        .single();

      if (error) {
        console.error('[ProjectCodebases] add error:', error);
        return null;
      }

      const codebase = row as ProjectCodebase;
      setCodebases((prev) => [codebase, ...prev]);
      return codebase;
    },
    [projectId]
  );

  const updateCodebase = useCallback(
    async (codebaseId: string, updates: Partial<ProjectCodebase>) => {
      if (!isSupabaseConfigured()) return;

      const { error } = await supabase
        .from('project_codebases')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', codebaseId);

      if (error) {
        console.error('[ProjectCodebases] update error:', error);
        return;
      }

      setCodebases((prev) =>
        prev.map((c) => (c.id === codebaseId ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const removeCodebase = useCallback(async (codebaseId: string) => {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
      .from('project_codebases')
      .delete()
      .eq('id', codebaseId);

    if (error) {
      console.error('[ProjectCodebases] remove error:', error);
      return;
    }

    setCodebases((prev) => prev.filter((c) => c.id !== codebaseId));
  }, []);

  return { codebases, loading, addCodebase, updateCodebase, removeCodebase };
}
