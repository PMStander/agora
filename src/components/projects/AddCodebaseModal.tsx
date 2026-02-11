import { useState } from 'react';
import { SOURCE_TYPE_LABELS, type CodebaseSourceType } from '../../types/projectCodebases';

interface Props {
  onAdd: (data: {
    name: string;
    source_type: CodebaseSourceType;
    path: string;
    branch?: string;
    description?: string;
    local_path?: string;
  }) => Promise<unknown>;
  onClose: () => void;
}

const SOURCE_TYPES: CodebaseSourceType[] = ['local', 'github', 'gitlab', 'bitbucket', 'url'];

export function AddCodebaseModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<CodebaseSourceType>('local');
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('');
  const [description, setDescription] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isGitSource = ['github', 'gitlab', 'bitbucket'].includes(sourceType);

  const handlePastePath = () => {
    // Auto-fill name from last path segment if empty
    if (path && !name) {
      const segments = path.split('/').filter(Boolean);
      const last = segments[segments.length - 1] || '';
      if (last) setName(last);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !path.trim()) return;
    setSubmitting(true);
    try {
      await onAdd({
        name: name.trim(),
        source_type: sourceType,
        path: path.trim(),
        branch: branch.trim() || undefined,
        description: description.trim() || undefined,
        local_path: localPath.trim() || undefined,
      });
      onClose();
    } catch {
      // Error handled in hook
    } finally {
      setSubmitting(false);
    }
  };

  const pathPlaceholder =
    sourceType === 'local'
      ? '/Users/you/project-folder'
      : sourceType === 'url'
      ? 'https://example.com/repo'
      : 'https://github.com/org/repo';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Link Codebase</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            {'\u2715'}
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Frontend App"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Source Type</label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_TYPES.map((st) => (
                <button
                  key={st}
                  onClick={() => setSourceType(st)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    sourceType === st
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {SOURCE_TYPE_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          {/* Path */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Path *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={pathPlaceholder}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
              {sourceType === 'local' && !name && path && (
                <button
                  onClick={handlePastePath}
                  className="px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:border-zinc-500 transition-colors shrink-0"
                  title="Auto-fill name from path"
                >
                  {'\u2190'} Name
                </button>
              )}
            </div>
          </div>

          {/* Branch (shown for git sources) */}
          {(isGitSource || sourceType === 'local') && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Branch (optional)</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Local Path (shown for git sources) */}
          {isGitSource && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Local Path (optional)</label>
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="/Users/you/project-folder"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
              <p className="text-[10px] text-zinc-600 mt-1">
                Local filesystem checkout so agents can read/write files
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Angular SPA with Tailwind CSS"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !path.trim() || submitting}
            className="px-4 py-2 text-xs bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Codebase'}
          </button>
        </div>
      </div>
    </div>
  );
}
