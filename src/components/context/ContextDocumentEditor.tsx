import { useState } from 'react';
import type { ContextDocument } from '../../types/context';

interface ContextDocumentEditorProps {
  document: ContextDocument;
  onSave: (content: string, expectedVersion: number) => Promise<{ success: boolean; conflict?: boolean }>;
  onCancel: () => void;
}

export function ContextDocumentEditor({
  document,
  onSave,
  onCancel,
}: ContextDocumentEditorProps) {
  const [content, setContent] = useState(document.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const result = await onSave(content, document.version);

    if (result.conflict) {
      setError(
        'Version conflict: another agent updated this document. Please reload and try again.'
      );
    } else if (!result.success) {
      setError('Failed to save. Please try again.');
    }

    setSaving(false);
    if (result.success) onCancel();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">
          Editing: {document.title}
        </h3>
        <span className="text-xs text-zinc-500">v{document.version}</span>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-[50vh] p-4 rounded-lg bg-zinc-900/80 border border-zinc-700 text-sm text-zinc-300 font-mono resize-none focus:border-amber-500 focus:outline-none"
        placeholder="Write markdown content..."
      />

      {error && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            saving
              ? 'bg-amber-500/10 text-amber-400/50 cursor-wait'
              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
          }`}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
