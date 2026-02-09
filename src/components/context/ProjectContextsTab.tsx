import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useProjectContext } from '../../hooks/useProjectContext';
import type { ContextAccessEntry } from '../../types/context';

interface ProjectContextsTabProps {
  agentId: string;
}

export function ProjectContextsTab({ agentId }: ProjectContextsTabProps) {
  const { projectContexts } = useProjectContext();
  const [accessEntries, setAccessEntries] = useState<ContextAccessEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    supabase
      .from('context_access')
      .select('*')
      .eq('agent_id', agentId)
      .then(({ data, error }) => {
        if (error) console.error('[ProjectContextsTab] fetch error:', error);
        else if (data) setAccessEntries(data as ContextAccessEntry[]);
        setLoading(false);
      });
  }, [agentId]);

  const accessibleContextIds = new Set(accessEntries.map((e) => e.project_context_id));
  const accessibleContexts = projectContexts.filter((c) => accessibleContextIds.has(c.id));

  if (loading) {
    return (
      <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
        Loading project contexts...
      </div>
    );
  }

  if (accessibleContexts.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2">📄</div>
        <p className="text-xs text-zinc-400">No project contexts accessible</p>
        <p className="text-xs text-zinc-600 mt-1">
          Access is granted when agents join missions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accessibleContexts.map((ctx) => {
        const access = accessEntries.find((e) => e.project_context_id === ctx.id);
        return (
          <div
            key={ctx.id}
            className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/50"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-zinc-200">{ctx.title}</h4>
              {access && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    access.access_level === 'admin'
                      ? 'bg-red-500/20 text-red-400'
                      : access.access_level === 'write'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {access.access_level}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Project: {ctx.project_id}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              Updated: {new Date(ctx.last_updated_at || ctx.created_at).toLocaleString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
