import { useEffect, useMemo, Suspense, lazy } from 'react';
import {
  useProjectsStore,
  useSelectedProject,
  PROJECT_STATUS_CONFIG,
  type WorkspaceTab,
} from '../../stores/projects';
import { useProjectAgents } from '../../hooks/useProjectAgents';

// Lazy-loaded tab content
const ProjectWorkspaceOverview = lazy(() =>
  import('./ProjectWorkspaceOverview').then((m) => ({ default: m.ProjectWorkspaceOverview }))
);
const ProjectWorkspaceMissions = lazy(() =>
  import('./ProjectWorkspaceMissions').then((m) => ({ default: m.ProjectWorkspaceMissions }))
);
const ProjectWorkspaceFiles = lazy(() =>
  import('./ProjectWorkspaceFiles').then((m) => ({ default: m.ProjectWorkspaceFiles }))
);
const ProjectWorkspaceContext = lazy(() =>
  import('./ProjectWorkspaceContext').then((m) => ({ default: m.ProjectWorkspaceContext }))
);
const ProjectWorkspaceSettings = lazy(() =>
  import('./ProjectWorkspaceSettings').then((m) => ({ default: m.ProjectWorkspaceSettings }))
);
const ProjectChatTab = lazy(() =>
  import('./ProjectChatTab').then((m) => ({ default: m.ProjectChatTab }))
);

// ─── Tab Config ─────────────────────────────────────────────────────────────

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '\uD83D\uDCCA' },
  { id: 'chat', label: 'Chat', icon: '\uD83D\uDCAC' },
  { id: 'missions', label: 'Missions', icon: '\uD83D\uDE80' },
  { id: 'files', label: 'Files', icon: '\uD83D\uDCCE' },
  { id: 'context', label: 'Context', icon: '\uD83D\uDCD6' },
  { id: 'settings', label: 'Setup', icon: '\u2699\uFE0F' },
];

const statusBadgeColors: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-300',
  blue: 'bg-blue-500/20 text-blue-300',
  amber: 'bg-amber-500/20 text-amber-300',
  green: 'bg-emerald-500/20 text-emerald-300',
  red: 'bg-red-500/20 text-red-300',
};

// ─── Loading Fallback ───────────────────────────────────────────────────────

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-xs text-zinc-600">Loading...</div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProjectDetail() {
  const project = useSelectedProject();
  const selectProject = useProjectsStore((s) => s.selectProject);
  const workspaceTab = useProjectsStore((s) => s.workspaceTab);
  const setWorkspaceTab = useProjectsStore((s) => s.setWorkspaceTab);
  const setActiveProjectForChat = useProjectsStore((s) => s.setActiveProjectForChat);
  const { assignments } = useProjectAgents(project?.id ?? null);
  const projectAgentIds = useMemo(
    () => assignments.map((a) => a.agent_id),
    [assignments]
  );

  // Auto-select this project as active chat context
  useEffect(() => {
    if (project?.id) {
      setActiveProjectForChat(project.id);
    }
  }, [project?.id, setActiveProjectForChat]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-zinc-500 text-sm">Select a project to view details</p>
      </div>
    );
  }

  const statusConfig = PROJECT_STATUS_CONFIG[project.status];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100 truncate">{project.name}</h2>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
              statusBadgeColors[statusConfig.color] ?? statusBadgeColors.zinc
            }`}
          >
            {statusConfig.label}
          </span>
        </div>
        <button
          onClick={() => selectProject(null)}
          className="text-zinc-500 hover:text-zinc-300 shrink-0"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-zinc-800 px-2">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setWorkspaceTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              workspaceTab === tab.id
                ? 'text-amber-400 border-amber-400'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            <span className="text-[11px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {workspaceTab === 'chat' ? (
        /* Chat tab manages its own scrolling and layout */
        <div className="flex-1 min-h-0">
          <Suspense fallback={<TabLoadingFallback />}>
            <ProjectChatTab project={project} projectAgentIds={projectAgentIds} />
          </Suspense>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <Suspense fallback={<TabLoadingFallback />}>
            {workspaceTab === 'overview' && <ProjectWorkspaceOverview project={project} />}
            {workspaceTab === 'missions' && <ProjectWorkspaceMissions project={project} />}
            {workspaceTab === 'files' && <ProjectWorkspaceFiles project={project} />}
            {workspaceTab === 'context' && <ProjectWorkspaceContext project={project} />}
            {workspaceTab === 'settings' && <ProjectWorkspaceSettings project={project} />}
          </Suspense>
        </div>
      )}
    </div>
  );
}
