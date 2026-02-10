import { useState, useRef, useEffect, useMemo } from 'react';
import { useProjectsStore } from '../../stores/projects';

/**
 * A pill/dropdown in the chat header showing the active project context.
 * Filters projects to those the current agent is assigned to (via crm_agent_assignments
 * loaded into the projects list). Falls back to showing all projects if assignments
 * aren't loaded yet.
 */
export function ProjectContextSelector() {
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectForChat);
  const setActiveProject = useProjectsStore((s) => s.setActiveProjectForChat);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Show active (non-archived) projects
  const availableProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.status !== 'cancelled'),
    [projects]
  );

  const activeProject = activeProjectId
    ? projects.find((p) => p.id === activeProjectId) ?? null
    : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
          activeProject
            ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }`}
        title={activeProject ? `Project context: ${activeProject.name}` : 'No project context'}
      >
        <span className="text-sm">
          {activeProject ? '\uD83D\uDCC2' : '\uD83D\uDCC1'}
        </span>
        <span className="max-w-[120px] truncate">
          {activeProject ? activeProject.name : 'No project'}
        </span>
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 overflow-hidden">
          {/* None option */}
          <button
            onClick={() => {
              setActiveProject(null);
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-xs transition-colors border-b border-zinc-800 ${
              !activeProjectId
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            No project context
          </button>

          {/* Project list */}
          <div className="max-h-48 overflow-y-auto">
            {availableProjects.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-3">No active projects</p>
            ) : (
              availableProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProject(p.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                    activeProjectId === p.id
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="truncate flex-1">{p.name}</span>
                  <span className="text-[10px] text-zinc-600 shrink-0">{p.status}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
