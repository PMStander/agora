import { lazy, Suspense } from 'react';
import { useAgentStore, useWorkspaceAgent, type AgentWorkspaceTab } from '../../../stores/agents';
import { LevelBadge } from '../LevelBadge';

const AgentWsOverview = lazy(() => import('./AgentWsOverview'));
const AgentWsIdentity = lazy(() => import('./AgentWsIdentity'));
const AgentWsSkills = lazy(() => import('./AgentWsSkills'));
const AgentWsFiles = lazy(() => import('./AgentWsFiles'));
const AgentWsProjects = lazy(() => import('./AgentWsProjects'));
const AgentWsPerformance = lazy(() => import('./AgentWsPerformance'));
const AgentWsGrowth = lazy(() => import('./AgentWsGrowth'));
const LazyDroidPanel = lazy(() => import('../../droid/DroidPanel').then(m => ({ default: m.DroidPanel })));

const WORKSPACE_TABS: Array<{ id: AgentWorkspaceTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'identity', label: 'Identity & SOUL', icon: '🧠' },
  { id: 'skills', label: 'Skills', icon: '🔧' },
  { id: 'files', label: 'Files & Sessions', icon: '📁' },
  { id: 'projects', label: 'Projects', icon: '📂' },
  { id: 'performance', label: 'Performance', icon: '📊' },
  { id: 'growth', label: 'Growth', icon: '🌱' },
  { id: 'droid', label: 'Droid', icon: '🤖' },
];

const LIFECYCLE_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  onboarding: 'bg-blue-500/20 text-blue-400',
  suspended: 'bg-red-500/20 text-red-400',
  retired: 'bg-zinc-500/20 text-zinc-400',
  candidate: 'bg-amber-500/20 text-amber-400',
};

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64 text-zinc-500">
      Loading...
    </div>
  );
}

export function AgentWorkspace() {
  const agent = useWorkspaceAgent();
  const workspaceTab = useAgentStore((s) => s.agentWorkspaceTab);
  const setTab = useAgentStore((s) => s.setAgentWorkspaceTab);
  const close = useAgentStore((s) => s.closeAgentWorkspace);

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        No agent selected
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <span className="text-2xl">{agent.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">
              {agent.name}
            </h1>
            <span className={`px-2 py-0.5 text-xs rounded-full ${LIFECYCLE_COLORS[agent.lifecycleStatus] ?? LIFECYCLE_COLORS.active}`}>
              {agent.lifecycleStatus}
            </span>
            <LevelBadge level={Math.min(4, Math.max(1, agent.soulVersion)) as 1 | 2 | 3 | 4} size="sm" />
          </div>
          <p className="text-sm text-zinc-500 truncate">{agent.role} &middot; {agent.persona}</p>
        </div>
        <button
          onClick={close}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-5 border-b border-zinc-800 bg-zinc-900/30">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${workspaceTab === tab.id
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }
            `}
          >
            <span className="text-xs">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {workspaceTab === 'droid' ? (
        <Suspense fallback={<TabLoadingFallback />}>
          <LazyDroidPanel className="flex-1 min-h-0" />
        </Suspense>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <Suspense fallback={<TabLoadingFallback />}>
            {workspaceTab === 'overview' && <AgentWsOverview agent={agent} />}
            {workspaceTab === 'identity' && <AgentWsIdentity agent={agent} />}
            {workspaceTab === 'skills' && <AgentWsSkills agent={agent} />}
            {workspaceTab === 'files' && <AgentWsFiles agent={agent} />}
            {workspaceTab === 'projects' && <AgentWsProjects agent={agent} />}
            {workspaceTab === 'performance' && <AgentWsPerformance agent={agent} />}
            {workspaceTab === 'growth' && <AgentWsGrowth agent={agent} />}
          </Suspense>
        </div>
      )}
    </div>
  );
}
