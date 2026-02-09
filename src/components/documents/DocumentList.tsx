import { useState } from 'react';
import type { CrmDocument } from '../../types/documents';
import { DOC_TYPE_CONFIG } from '../../types/documents';
import { formatFileSize } from '../../lib/csvUtils';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Component ──────────────────────────────────────────────────────────────

interface DocumentListProps {
  documents: CrmDocument[];
  onDownload: (doc: CrmDocument) => void;
  onDelete: (doc: CrmDocument) => void;
  loading?: boolean;
}

export function DocumentList({ documents, onDownload, onDelete, loading }: DocumentListProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = [...documents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const displayDocs = expanded ? sorted : sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  if (documents.length === 0 && !loading) {
    return <p className="text-xs text-zinc-600">No documents attached</p>;
  }

  const handleDelete = (doc: CrmDocument) => {
    if (confirmDeleteId === doc.id) {
      onDelete(doc);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(doc.id);
    }
  };

  return (
    <div className="space-y-1.5">
      {displayDocs.map((doc) => {
        const typeConfig = DOC_TYPE_CONFIG[doc.doc_type];
        return (
          <div
            key={doc.id}
            className="flex items-center gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2 group"
          >
            <span className="text-sm shrink-0" title={typeConfig.label}>
              {typeConfig.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-300 truncate" title={doc.title}>
                {doc.title}
              </div>
              <div className="text-[10px] text-zinc-600 flex items-center gap-1.5">
                {doc.file_size != null && (
                  <span>{formatFileSize(doc.file_size)}</span>
                )}
                <span>{relativeTime(doc.created_at)}</span>
              </div>
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1 py-0 text-[9px] bg-zinc-700/50 text-zinc-500 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onDownload(doc)}
                className="p-1 text-zinc-500 hover:text-amber-400 transition-colors"
                title="Download"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(doc)}
                className={`p-1 transition-colors ${
                  confirmDeleteId === doc.id
                    ? 'text-red-400'
                    : 'text-zinc-500 hover:text-red-400'
                }`}
                title={confirmDeleteId === doc.id ? 'Click again to confirm' : 'Delete'}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-[10px] text-amber-400 hover:text-amber-300 py-1 transition-colors"
        >
          Show all ({sorted.length})
        </button>
      )}
      {hasMore && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full text-[10px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}
