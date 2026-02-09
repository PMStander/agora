import type { ContextDocument } from '../../types/context';

interface ContextDocumentViewProps {
  document: ContextDocument;
  onEdit: () => void;
}

export function ContextDocumentView({ document, onEdit }: ContextDocumentViewProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{document.title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Last updated by {document.last_updated_by_agent_id} | v{document.version} |{' '}
            {new Date(document.updated_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
        >
          Edit
        </button>
      </div>

      {/* Content rendered as pre-formatted text (simplified markdown) */}
      <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-700 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[60vh] overflow-y-auto">
        {document.content || '(empty document)'}
      </div>
    </div>
  );
}
