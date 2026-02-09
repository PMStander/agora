import { useState, useEffect } from 'react';
import type { ContextRevision } from '../../types/context';
import { useProjectContext } from '../../hooks/useProjectContext';

interface RevisionHistoryProps {
  documentId: string;
}

export function RevisionHistory({ documentId }: RevisionHistoryProps) {
  const { getRevisionHistory } = useProjectContext();
  const [revisions, setRevisions] = useState<ContextRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getRevisionHistory(documentId).then((data) => {
      setRevisions(data);
      setLoading(false);
    });
  }, [documentId, getRevisionHistory]);

  if (loading) {
    return (
      <div className="p-3 text-xs text-zinc-500 animate-pulse">
        Loading revision history...
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="p-3 text-xs text-zinc-500">No revisions yet</div>
    );
  }

  return (
    <div className="space-y-1">
      <h4 className="text-xs text-zinc-400 uppercase tracking-wider px-1 mb-2">
        Revision History
      </h4>
      {revisions.map((rev) => (
        <button
          key={rev.id}
          onClick={() => setExpandedId(expandedId === rev.id ? null : rev.id)}
          className="w-full text-left p-2 rounded hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">v{rev.version}</span>
            <span className="text-xs text-zinc-600">
              {new Date(rev.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {rev.agent_id} - {rev.diff_summary}
          </p>
          {expandedId === rev.id && (
            <pre className="mt-2 p-2 rounded bg-zinc-900 text-xs text-zinc-400 whitespace-pre-wrap max-h-40 overflow-y-auto border border-zinc-700">
              {rev.content_snapshot}
            </pre>
          )}
        </button>
      ))}
    </div>
  );
}
