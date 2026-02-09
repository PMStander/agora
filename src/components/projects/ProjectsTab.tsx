import { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { useProjectsStore, useSelectedProject } from '../../stores/projects';
import { ProjectList } from './ProjectList';
import { ProjectDetail } from './ProjectDetail';
import { CreateProjectModal } from './CreateProjectModal';

// ─── Component ──────────────────────────────────────────────────────────────

export function ProjectsTab() {
  const { isConfigured } = useProjects();
  const activeSubTab = useProjectsStore((s) => s.activeSubTab);
  const setActiveSubTab = useProjectsStore((s) => s.setActiveSubTab);
  const searchQuery = useProjectsStore((s) => s.searchQuery);
  const setSearchQuery = useProjectsStore((s) => s.setSearchQuery);
  const selectedProject = useSelectedProject();

  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-zinc-100">Projects</h1>
          {!isConfigured && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Local Mode
            </span>
          )}

          {/* Sub-nav tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
            {(['active', 'archive'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-2.5 py-1 text-xs rounded capitalize ${
                  activeSubTab === tab
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 w-56"
          />
          {/* New Project */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Project list (left / full when no selection) */}
        <div className={`${selectedProject ? 'w-1/2 border-r border-zinc-800' : 'w-full'} overflow-hidden`}>
          <ProjectList />
        </div>

        {/* Project detail (right panel inside the tab) */}
        {selectedProject && (
          <div className="w-1/2 overflow-hidden">
            <ProjectDetail />
          </div>
        )}
      </div>

      {/* Create modal */}
      {createModalOpen && (
        <CreateProjectModal onClose={() => setCreateModalOpen(false)} />
      )}
    </div>
  );
}
