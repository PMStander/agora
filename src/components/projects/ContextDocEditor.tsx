import { useState, useRef, useCallback, useEffect } from 'react';
import type { ContextDocument, ContextDocType } from '../../types/context';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<ContextDocType, { label: string; color: string }> = {
  context: { label: 'Context', color: 'bg-amber-500/20 text-amber-300' },
  research: { label: 'Research', color: 'bg-blue-500/20 text-blue-300' },
  decision_log: { label: 'Decisions', color: 'bg-purple-500/20 text-purple-300' },
  access: { label: 'Access', color: 'bg-zinc-500/20 text-zinc-300' },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  doc: ContextDocument;
  onUpdate: (
    docId: string,
    content: string,
    version: number
  ) => Promise<{ success: boolean; conflict?: boolean }>;
  onUpdateTitle: (docId: string, title: string) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
}

export function ContextDocEditor({ doc, onUpdate, onUpdateTitle, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(doc.content);
  const [title, setTitle] = useState(doc.title);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync content when doc changes externally
  useEffect(() => {
    if (!saving) {
      setContent(doc.content);
      setTitle(doc.title);
    }
  }, [doc.content, doc.title, saving]);

  const handleSave = useCallback(
    async (newContent: string) => {
      setSaving(true);
      setConflict(false);
      const result = await onUpdate(doc.id, newContent, doc.version);
      if (result.conflict) {
        setConflict(true);
      }
      setSaving(false);
    },
    [doc.id, doc.version, onUpdate]
  );

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // Auto-save debounce (1.5s)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSave(newContent);
    }, 1500);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (content !== doc.content) {
      handleSave(content);
    }
  };

  const handleTitleBlur = () => {
    if (title !== doc.title && title.trim()) {
      onUpdateTitle(doc.id, title.trim());
    }
  };

  const docTypeConfig = DOC_TYPE_LABELS[doc.doc_type] || DOC_TYPE_LABELS.context;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`w-3 h-3 text-zinc-500 shrink-0 transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-zinc-200 truncate">{doc.title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${docTypeConfig.color}`}>
            {docTypeConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-600">v{doc.version}</span>
          <span className="text-[10px] text-zinc-600">{formatRelativeTime(doc.updated_at)}</span>
        </div>
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-zinc-800 p-3 space-y-2">
          {/* Editable title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
          />

          {/* Content editor */}
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleBlur}
            rows={12}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-300 resize-y font-mono leading-relaxed focus:outline-none focus:border-amber-500"
          />

          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {saving && <span className="text-[10px] text-amber-400">Saving...</span>}
              {conflict && (
                <span className="text-[10px] text-red-400">
                  {'\u26A0\uFE0F'} Version conflict — reload and try again
                </span>
              )}
              <span className="text-[10px] text-zinc-600">
                {'\uD83E\uDD16'} Injected into agent context
              </span>
            </div>
            <div className="flex items-center gap-2">
              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-red-400">Delete?</span>
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[10px] text-zinc-500"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-[10px] text-zinc-600 hover:text-red-400"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="text-[10px] text-zinc-600 hover:text-zinc-400"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
