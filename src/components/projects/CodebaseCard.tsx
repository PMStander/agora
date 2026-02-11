import { useState } from 'react';
import { SOURCE_TYPE_ICONS, SOURCE_TYPE_LABELS } from '../../types/projectCodebases';
import type { ProjectCodebase } from '../../types/projectCodebases';

interface Props {
  codebase: ProjectCodebase;
  onRemove: (id: string) => void;
}

export function CodebaseCard({ codebase, onRemove }: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const icon = SOURCE_TYPE_ICONS[codebase.source_type] || '\uD83D\uDCC1';
  const typeLabel = SOURCE_TYPE_LABELS[codebase.source_type] || codebase.source_type;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{icon}</span>
          <span className="text-xs font-medium text-zinc-200 truncate">{codebase.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded border border-zinc-700">
            {typeLabel}
          </span>
          {confirmRemove ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRemove(codebase.id)}
                className="text-[10px] text-red-400 hover:text-red-300"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-[10px] text-zinc-500"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="text-xs text-zinc-600 hover:text-red-400"
              title="Remove codebase"
            >
              {'\u2715'}
            </button>
          )}
        </div>
      </div>

      <div className="font-mono text-[11px] text-zinc-500 truncate">{codebase.path}</div>

      {codebase.local_path && (
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-600 truncate">
          <span className="text-[10px] text-zinc-600">📂</span>
          <span className="truncate">{codebase.local_path}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
        {codebase.branch && (
          <span className="px-1.5 py-0.5 bg-zinc-800 rounded">{codebase.branch}</span>
        )}
        {codebase.description && (
          <span className="truncate">{codebase.description}</span>
        )}
      </div>
    </div>
  );
}
