import { useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useContextStore } from '../stores/context';
import type {
  ProjectContext,
  ContextDocument,
  ContextAccessEntry,
  ContextRevision,
} from '../types/context';

export function useProjectContext() {
  const {
    projectContexts,
    activeContextId,
    setProjectContexts,
    addProjectContext,
    updateProjectContext,
    setActiveContext,
  } = useContextStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime ──────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    supabase
      .from('project_contexts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[ProjectContext] fetch error:', error);
        else if (data) setProjectContexts(data as ProjectContext[]);
      });

    const channel = supabase
      .channel('project-contexts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_contexts' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            addProjectContext(payload.new as ProjectContext);
          } else if (payload.eventType === 'DELETE') {
            useContextStore.getState().removeProjectContext(String(payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [addProjectContext, setProjectContexts]);

  // ── Create project context ────────────────────────────────────────────
  const createProjectContext = useCallback(
    async (projectId: string, title: string) => {
      if (!isSupabaseConfigured()) return null;

      const { data: ctx, error } = await supabase
        .from('project_contexts')
        .insert({ project_id: projectId, title })
        .select()
        .single();

      if (error) {
        console.error('[ProjectContext] create error:', error);
        return null;
      }

      // Create a default context document
      await supabase.from('context_documents').insert({
        project_context_id: ctx.id,
        doc_type: 'context',
        title: 'CONTEXT.md',
        content: `# ${title}\n\nProject context document. Add learnings, decisions, and current state here.\n`,
        last_updated_by_agent_id: 'user',
        version: 1,
      });

      addProjectContext(ctx as ProjectContext);
      return ctx as ProjectContext;
    },
    [addProjectContext]
  );

  // ── Get project context with documents and access ─────────────────────
  const getProjectContext = useCallback(
    async (projectId: string) => {
      if (!isSupabaseConfigured()) return null;

      const { data: ctx, error } = await supabase
        .from('project_contexts')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error || !ctx) return null;

      const [docsRes, accessRes] = await Promise.all([
        supabase
          .from('context_documents')
          .select('*')
          .eq('project_context_id', ctx.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('context_access')
          .select('*')
          .eq('project_context_id', ctx.id),
      ]);

      return {
        ...ctx,
        documents: (docsRes.data || []) as ContextDocument[],
        access: (accessRes.data || []) as ContextAccessEntry[],
      };
    },
    []
  );

  // ── Update document with optimistic locking ───────────────────────────
  const updateDocument = useCallback(
    async (
      docId: string,
      content: string,
      expectedVersion: number,
      agentId: string = 'user'
    ): Promise<{ success: boolean; conflict?: boolean }> => {
      if (!isSupabaseConfigured()) return { success: false };

      const newVersion = expectedVersion + 1;
      const { data, error } = await supabase
        .from('context_documents')
        .update({
          content,
          version: newVersion,
          last_updated_by_agent_id: agentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId)
        .eq('version', expectedVersion)
        .select();

      if (error) {
        console.error('[ProjectContext] update doc error:', error);
        return { success: false };
      }

      if (!data || data.length === 0) {
        return { success: false, conflict: true };
      }

      // Create revision
      await supabase.from('context_revisions').insert({
        context_document_id: docId,
        agent_id: agentId,
        diff_summary: 'Document updated',
        content_snapshot: content,
        version: newVersion,
      });

      return { success: true };
    },
    []
  );

  // ── Grant/revoke access ───────────────────────────────────────────────
  const grantAccess = useCallback(
    async (
      projectContextId: string,
      agentId: string,
      accessLevel: 'read' | 'write' | 'admin',
      grantedBy: string = 'user'
    ) => {
      if (!isSupabaseConfigured()) return false;

      const { error } = await supabase.from('context_access').upsert(
        {
          project_context_id: projectContextId,
          agent_id: agentId,
          access_level: accessLevel,
          granted_by: grantedBy,
        },
        { onConflict: 'project_context_id,agent_id' }
      );

      if (error) {
        console.error('[ProjectContext] grant access error:', error);
        return false;
      }
      return true;
    },
    []
  );

  const revokeAccess = useCallback(
    async (projectContextId: string, agentId: string) => {
      if (!isSupabaseConfigured()) return false;

      const { error } = await supabase
        .from('context_access')
        .delete()
        .eq('project_context_id', projectContextId)
        .eq('agent_id', agentId);

      if (error) {
        console.error('[ProjectContext] revoke access error:', error);
        return false;
      }
      return true;
    },
    []
  );

  // ── Get revision history ──────────────────────────────────────────────
  const getRevisionHistory = useCallback(
    async (docId: string): Promise<ContextRevision[]> => {
      if (!isSupabaseConfigured()) return [];

      const { data, error } = await supabase
        .from('context_revisions')
        .select('*')
        .eq('context_document_id', docId)
        .order('version', { ascending: false });

      if (error) {
        console.error('[ProjectContext] revision history error:', error);
        return [];
      }
      return (data || []) as ContextRevision[];
    },
    []
  );

  // ── Auto-create context for mission ───────────────────────────────────
  const autoCreateContextForMission = useCallback(
    async (missionId: string, missionTitle: string, agentId: string) => {
      const existing = await getProjectContext(missionId);
      if (existing) return existing;

      const ctx = await createProjectContext(missionId, missionTitle);
      if (ctx) {
        await grantAccess(ctx.id, agentId, 'write');
      }
      return ctx;
    },
    [createProjectContext, getProjectContext, grantAccess]
  );

  // ── Get documents for a context ───────────────────────────────────────
  const getDocuments = useCallback(
    async (projectContextId: string): Promise<ContextDocument[]> => {
      if (!isSupabaseConfigured()) return [];

      const { data, error } = await supabase
        .from('context_documents')
        .select('*')
        .eq('project_context_id', projectContextId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[ProjectContext] get documents error:', error);
        return [];
      }
      return (data || []) as ContextDocument[];
    },
    []
  );

  return {
    projectContexts,
    activeContextId,
    setActiveContext,
    createProjectContext,
    getProjectContext,
    updateDocument,
    grantAccess,
    revokeAccess,
    getRevisionHistory,
    autoCreateContextForMission,
    getDocuments,
    updateProjectContext,
  };
}
