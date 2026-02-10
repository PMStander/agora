import { useState } from 'react';
import { DocumentSection } from '../documents/DocumentSection';
import { useProjectCodebases } from '../../hooks/useProjectCodebases';
import { CodebaseCard } from './CodebaseCard';
import { AddCodebaseModal } from './AddCodebaseModal';
import type { Project } from '../../stores/projects';

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  project: Project;
}

export function ProjectWorkspaceFiles({ project }: Props) {
  const { codebases, loading, addCodebase, removeCodebase } = useProjectCodebases(project.id);
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Section 1: Files & Media */}
      <div>
        <DocumentSection
          entityType="project"
          entityId={project.id}
          title="Files & Media"
        />
      </div>

      {/* Section 2: Linked Codebases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-500">
            Codebases ({codebases.length})
          </label>
          <button
            onClick={() => setAddModalOpen(true)}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            + Link Codebase
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-zinc-600 text-center py-4">Loading...</div>
        ) : codebases.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500">No codebases linked</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Link a local path or repository so agents know about your code
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {codebases.map((cb) => (
              <CodebaseCard key={cb.id} codebase={cb} onRemove={removeCodebase} />
            ))}
          </div>
        )}
      </div>

      {/* Add Codebase Modal */}
      {addModalOpen && (
        <AddCodebaseModal
          onAdd={addCodebase}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}
