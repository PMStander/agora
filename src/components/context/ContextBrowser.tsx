import { useState } from 'react';
import { useProjectContext } from '../../hooks/useProjectContext';
import { ProjectContextCard } from './ProjectContextCard';
import { ContextEditor } from './ContextEditor';

export function ContextBrowser() {
  const { projectContexts, activeContextId, setActiveContext } = useProjectContext();
  const [viewingContextId, setViewingContextId] = useState<string | null>(null);

  if (viewingContextId) {
    return (
      <ContextEditor
        projectContextId={viewingContextId}
        onBack={() => setViewingContextId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">Project Contexts</h2>
        <span className="text-xs text-zinc-500">{projectContexts.length} contexts</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {projectContexts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">📄</div>
            <p className="text-sm text-zinc-400">No project contexts yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Contexts are auto-created when missions start
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectContexts.map((ctx) => (
              <ProjectContextCard
                key={ctx.id}
                context={ctx}
                isActive={ctx.id === activeContextId}
                onSelect={(id) => {
                  setActiveContext(id);
                  setViewingContextId(id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
