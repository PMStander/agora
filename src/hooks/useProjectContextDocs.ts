import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { ContextDocument, ContextDocType } from '../types/context';

/**
 * Manages context documents for a specific project.
 * Auto-creates the project_context + default CONTEXT.md if none exists.
 * Uses optimistic locking (version field) for updates.
 */
export function useProjectContextDocs(projectId: string | null) {
  const [docs, setDocs] = useState<ContextDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextId, setContextId] = useState<string | null>(null);
  const subscribedProjectRef = useRef<string | null>(null);

  // ── Init: find or create project_context, then fetch docs ──────────────

  useEffect(() => {
    if (!isSupabaseConfigured() || !projectId) {
      setDocs([]);
      setContextId(null);
      return;
    }

    if (subscribedProjectRef.current === projectId) return;
    subscribedProjectRef.current = projectId;

    setLoading(true);

    (async () => {
      // Find existing project_context
      let { data: ctx } = await supabase
        .from('project_contexts')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();

      // Auto-create if missing
      if (!ctx) {
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .single();

        const title = project?.name || 'Project Context';

        const { data: newCtx, error: createErr } = await supabase
          .from('project_contexts')
          .insert({ project_id: projectId, title })
          .select('id')
          .single();

        if (createErr) {
          console.error('[ProjectContextDocs] create context error:', createErr);
          setLoading(false);
          return;
        }

        ctx = newCtx;

        // Create default CONTEXT.md
        await supabase.from('context_documents').insert({
          project_context_id: ctx!.id,
          doc_type: 'context',
          title: 'CONTEXT.md',
          content: `# ${title}\n\nProject context document. Add learnings, decisions, and current state here.\n`,
          last_updated_by_agent_id: 'user',
          version: 1,
        });
      }

      setContextId(ctx!.id);

      // Fetch documents
      const { data: docsData, error: docsErr } = await supabase
        .from('context_documents')
        .select('*')
        .eq('project_context_id', ctx!.id)
        .order('updated_at', { ascending: false });

      if (docsErr) console.error('[ProjectContextDocs] fetch docs error:', docsErr);
      else setDocs((docsData || []) as ContextDocument[]);

      setLoading(false);
    })();
  }, [projectId]);

  // ── Realtime on context_documents (once we have contextId) ─────────────

  useEffect(() => {
    if (!contextId) return;

    const channel = supabase
      .channel(`context-docs-${contextId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'context_documents',
        },
        (payload) => {
          const row = (payload.new || payload.old) as ContextDocument;

          if (payload.eventType === 'INSERT') {
            if (row.project_context_id === contextId) {
              setDocs((prev) => {
                if (prev.some((d) => d.id === row.id)) return prev;
                return [row, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            if (row.project_context_id === contextId) {
              setDocs((prev) =>
                prev.map((d) => (d.id === row.id ? { ...d, ...row } : d))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setDocs((prev) => prev.filter((d) => d.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [contextId]);

  // ── CRUD ────────────────────────────────────────────────────────────────

  const createDoc = useCallback(
    async (title: string, content: string, docType: ContextDocType = 'context') => {
      if (!isSupabaseConfigured() || !contextId) return null;

      const { data, error } = await supabase
        .from('context_documents')
        .insert({
          project_context_id: contextId,
          doc_type: docType,
          title,
          content,
          last_updated_by_agent_id: 'user',
          version: 1,
        })
        .select()
        .single();

      if (error) {
        console.error('[ProjectContextDocs] create doc error:', error);
        return null;
      }

      const doc = data as ContextDocument;
      setDocs((prev) => [doc, ...prev]);
      return doc;
    },
    [contextId]
  );

  const updateDoc = useCallback(
    async (
      docId: string,
      content: string,
      expectedVersion: number
    ): Promise<{ success: boolean; conflict?: boolean }> => {
      if (!isSupabaseConfigured()) return { success: false };

      const newVersion = expectedVersion + 1;
      const { data, error } = await supabase
        .from('context_documents')
        .update({
          content,
          version: newVersion,
          last_updated_by_agent_id: 'user',
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId)
        .eq('version', expectedVersion)
        .select();

      if (error) {
        console.error('[ProjectContextDocs] update doc error:', error);
        return { success: false };
      }

      if (!data || data.length === 0) {
        return { success: false, conflict: true };
      }

      // Update local state
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, content, version: newVersion, updated_at: new Date().toISOString() }
            : d
        )
      );

      // Create revision for audit trail
      await supabase.from('context_revisions').insert({
        context_document_id: docId,
        agent_id: 'user',
        diff_summary: 'Document updated',
        content_snapshot: content,
        version: newVersion,
      });

      return { success: true };
    },
    []
  );

  const updateDocTitle = useCallback(
    async (docId: string, title: string) => {
      if (!isSupabaseConfigured()) return;

      const { error } = await supabase
        .from('context_documents')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', docId);

      if (error) {
        console.error('[ProjectContextDocs] update title error:', error);
        return;
      }

      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, title } : d))
      );
    },
    []
  );

  const deleteDoc = useCallback(async (docId: string) => {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
      .from('context_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      console.error('[ProjectContextDocs] delete doc error:', error);
      return;
    }

    setDocs((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  return { docs, loading, contextId, createDoc, updateDoc, updateDocTitle, deleteDoc };
}
