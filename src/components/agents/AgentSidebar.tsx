import { useState } from 'react';
import { useAgentStore, useActiveAgent, type Agent, type Team } from '../../stores/agents';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import { SubAgentPanel } from './SubAgentPanel';
import { HireAgentButton } from './HireAgentButton';
import { LevelBadge } from './LevelBadge';
import { useAgentLevel } from '../../hooks/useAgentLevel';
import { useMissionControlStore } from '../../stores/missionControl';
import { cn } from '../../lib/utils';
import type { AgentLifecycleStatus } from '../../types/supabase';

interface AgentItemProps {
  agent: Agent;
  isActive: boolean;
  isConnected: boolean;
  level?: 1 | 2 | 3 | 4;
  lifecycleStatus?: AgentLifecycleStatus;
  onClick: () => void;
  onProfileClick: () => void;
}

const LIFECYCLE_COLORS: Record<AgentLifecycleStatus, string> = {
  active: 'bg-green-500/20 text-green-400',
  onboarding: 'bg-amber-500/20 text-amber-400',
  suspended: 'bg-zinc-500/20 text-zinc-400',
  retired: 'bg-red-500/20 text-red-400',
  candidate: 'bg-blue-500/20 text-blue-400',
};

function AgentItem({ agent, isActive, isConnected, level, lifecycleStatus, onClick, onProfileClick }: AgentItemProps) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onProfileClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      )}
      title="Click to select, double-click for profile"
    >
      <div className="relative">
        <img
          src={agent.avatar}
          alt={agent.name}
          className="w-10 h-10 rounded-full object-cover border-2 border-border"
          onError={(e) => {
            // Fallback to emoji if avatar fails to load
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <span className="hidden w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">
          {agent.emoji}
        </span>
        {/* Online indicator */}
        <span
          className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background',
            isConnected ? 'bg-green-500' : 'bg-zinc-500'
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 font-medium truncate">
          {agent.name}
          {level && <LevelBadge level={level} />}
          {lifecycleStatus && lifecycleStatus !== 'active' && (
            <span className={cn('text-[9px] uppercase tracking-wider px-1 py-0.5 rounded-full', LIFECYCLE_COLORS[lifecycleStatus])}>
              {lifecycleStatus}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">{agent.role}</div>
      </div>
    </button>
  );
}

/* Compact icon-only agent item for collapsed sidebar */
function AgentItemCollapsed({ agent, isActive, isConnected, onClick }: {
  agent: Agent;
  isActive: boolean;
  isConnected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-9 h-9 rounded-full flex items-center justify-center transition-colors mx-auto',
        isActive
          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
          : 'hover:bg-muted'
      )}
      title={agent.name}
    >
      <img
        src={agent.avatar}
        alt={agent.name}
        className="w-8 h-8 rounded-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
      <span className="hidden w-8 h-8 rounded-full bg-muted flex items-center justify-center text-base">
        {agent.emoji}
      </span>
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background',
          isConnected ? 'bg-green-500' : 'bg-zinc-500'
        )}
      />
    </button>
  );
}

interface TeamSectionProps {
  team: Team;
  activeAgentId: string;
  isConnected: boolean;
  agentLevelMap: Record<string, 1 | 2 | 3 | 4>;
  lifecycleMap: Record<string, AgentLifecycleStatus>;
  onAgentSelect: (agentId: string) => void;
  onProfileClick: (agentId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function TeamSection({ team, activeAgentId, isConnected, agentLevelMap, lifecycleMap, onAgentSelect, onProfileClick, isCollapsed, onToggleCollapse }: TeamSectionProps) {
  // State for collapsed sub-teams (keyed by parentAgentId)
  const [collapsedSubTeams, setCollapsedSubTeams] = useState<Set<string>>(new Set());

  const toggleSubTeam = (parentId: string) => {
    setCollapsedSubTeams(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  // Separate top-level agents from sub-team agents
  const topLevelAgents = team.agents.filter(a => !a.parentAgentId);
  const subAgentsByParent = new Map<string, { label: string; agents: Agent[] }>();
  for (const agent of team.agents) {
    if (agent.parentAgentId && agent.subTeamLabel) {
      const existing = subAgentsByParent.get(agent.parentAgentId);
      if (existing) {
        existing.agents.push(agent);
      } else {
        subAgentsByParent.set(agent.parentAgentId, {
          label: agent.subTeamLabel,
          agents: [agent],
        });
      }
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={onToggleCollapse}
        className="w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 hover:bg-muted/50 rounded-lg transition-colors text-left"
      >
        <svg
          className={cn(
            'w-4 h-4 transition-transform',
            isCollapsed ? '-rotate-90' : 'rotate-0'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>{team.emoji}</span>
        <span>{team.name}</span>
        <span className="ml-auto text-[10px] opacity-60">
          {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}
        </span>
      </button>
      {!isCollapsed && (
        <div className="space-y-1">
          {topLevelAgents.map((agent) => {
            const subTeam = subAgentsByParent.get(agent.id);
            return (
              <div key={agent.id}>
                <AgentItem
                  agent={agent}
                  isActive={agent.id === activeAgentId}
                  isConnected={isConnected}
                  level={agentLevelMap[agent.id]}
                  lifecycleStatus={lifecycleMap[agent.id]}
                  onClick={() => onAgentSelect(agent.id)}
                  onProfileClick={() => onProfileClick(agent.id)}
                />
                {/* Sub-team under this parent */}
                {subTeam && (
                  <div className="ml-5 mt-1 mb-1 border-l border-border/50 pl-2">
                    <button
                      onClick={() => toggleSubTeam(agent.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors rounded text-left"
                    >
                      <svg
                        className={cn(
                          'w-3 h-3 transition-transform',
                          collapsedSubTeams.has(agent.id) ? '-rotate-90' : 'rotate-0'
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {subTeam.label}
                      <span className="opacity-50">{subTeam.agents.length}</span>
                    </button>
                    {!collapsedSubTeams.has(agent.id) && (
                      <div className="space-y-0.5 mt-0.5">
                        {subTeam.agents.map((subAgent) => (
                          <AgentItem
                            key={subAgent.id}
                            agent={subAgent}
                            isActive={subAgent.id === activeAgentId}
                            isConnected={isConnected}
                            level={agentLevelMap[subAgent.id]}
                            lifecycleStatus={lifecycleMap[subAgent.id]}
                            onClick={() => onAgentSelect(subAgent.id)}
                            onProfileClick={() => onProfileClick(subAgent.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AgentSidebarProps {
  onSettingsClick?: () => void;
}

export function AgentSidebar({ onSettingsClick }: AgentSidebarProps) {
  const teams = useAgentStore((s) => s.teams);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  const isConnected = useAgentStore((s) => s.isConnected);
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const openHiringWizard = useAgentStore((s) => s.openHiringWizard);
  const setSelectedProfileAgentId = useAgentStore((s) => s.setSelectedProfileAgentId);
  const { spawnSubAgent, onSubAgentRunEvent } = useOpenClaw();
  const { agentLevels } = useAgentLevel();
  const connectionQuality = useMissionControlStore((s) => s.connectionQuality);
  const reconnecting = useMissionControlStore((s) => s.reconnecting);
  const activeAgent = useActiveAgent();
  const activeTeamId = teams.find((team) => team.agents.some((agent) => agent.id === activeAgentId))?.id;
  const routeTeams = teams;

  // Effective connection: must be connected AND quality not lost
  const effectiveConnected = isConnected && connectionQuality !== 'lost' && !reconnecting;

  // Build a simple map of agentId -> level for passing to TeamSection
  const agentLevelMap: Record<string, 1 | 2 | 3 | 4> = {};
  for (const [id, state] of Object.entries(agentLevels)) {
    agentLevelMap[id] = state.current_level;
  }

  // Build lifecycle status map from profiles
  const lifecycleMap: Record<string, AgentLifecycleStatus> = {};
  for (const [id, profile] of Object.entries(agentProfiles)) {
    lifecycleMap[id] = profile.lifecycleStatus;
  }

  // State for collapsed teams and sidebar collapsed
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleTeamCollapse = (teamId: string) => {
    setCollapsedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  // Connection status dot color
  const connectionDotColor = effectiveConnected
    ? 'bg-green-500'
    : reconnecting || connectionQuality === 'degraded'
    ? 'bg-yellow-500 animate-pulse'
    : 'bg-red-500';

  // ─── Collapsed sidebar: icon-only rail ───
  if (sidebarCollapsed) {
    return (
      <aside className="w-14 bg-card border-r border-border flex flex-col h-full items-center py-3">
        {/* Agora icon + connection dot */}
        <div className="relative mb-3">
          <img
            src="/agora-icon.png"
            alt="Agora"
            className="w-8 h-8 rounded-lg"
          />
          <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background', connectionDotColor)} />
        </div>

        {/* Divider */}
        <div className="w-6 border-t border-border mb-1" />

        {/* Agent icons grouped by team — scrollable */}
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-0.5 px-1 py-1">
          {teams.map((team, teamIdx) => (
            <div key={team.id} className="flex flex-col items-center w-full">
              {/* Team emoji header */}
              <div
                className={cn(
                  'text-sm py-1 cursor-default select-none',
                  teamIdx > 0 && 'mt-2 pt-2 border-t border-border/50 w-6'
                )}
                title={team.name}
              >
                <span className="block text-center">{team.emoji}</span>
              </div>
              {/* Team agents */}
              <div className="flex flex-col items-center gap-1.5 mt-1">
                {team.agents.map((agent) => (
                  <AgentItemCollapsed
                    key={agent.id}
                    agent={agent}
                    isActive={agent.id === activeAgentId}
                    isConnected={effectiveConnected}
                    onClick={() => setActiveAgent(agent.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-2 mt-2">
          {/* Settings */}
          <button
            onClick={onSettingsClick}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Settings (⌘,)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Expand sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  // ─── Expanded sidebar (default) ───
  return (
    <aside className="w-72 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src="/agora-icon.png"
            alt="Agora"
            className="w-10 h-10 rounded-lg"
          />
          <div className="flex-1">
            <h1 className="font-bold text-lg">Agora</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn('w-2 h-2 rounded-full', connectionDotColor)} />
              {effectiveConnected
                ? 'Connected'
                : reconnecting
                ? 'Reconnecting...'
                : connectionQuality === 'degraded'
                ? 'Degraded'
                : 'Disconnected'}
            </div>
          </div>
          {/* Settings Button */}
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Settings (⌘,)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Collapse sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Team Routes */}
      <div className="px-3 py-3 border-b border-border">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Routes</div>
        <div className="mt-2 space-y-1.5">
          {routeTeams.map((team) => {
            const lead = team.agents[0];
            if (!lead) return null;
            const isActiveTeam = activeTeamId === team.id;
            return (
              <button
                key={team.id}
                onClick={() => setActiveAgent(lead.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors',
                  isActiveTeam
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title={`Switch to ${team.name}`}
              >
                <span className="text-sm truncate">{team.emoji} {team.name}</span>
                <span className="text-[10px] uppercase tracking-wider opacity-75">Lead: {lead.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {teams.map((team) => (
          <TeamSection
            key={team.id}
            team={team}
            activeAgentId={activeAgentId}
            isConnected={effectiveConnected}
            agentLevelMap={agentLevelMap}
            lifecycleMap={lifecycleMap}
            onAgentSelect={setActiveAgent}
            onProfileClick={(agentId) => setSelectedProfileAgentId(agentId)}
            isCollapsed={collapsedTeams.has(team.id)}
            onToggleCollapse={() => toggleTeamCollapse(team.id)}
          />
        ))}
      </div>

      {/* Hire Agent Button */}
      <div className="px-3 py-2">
        <HireAgentButton onClick={openHiringWizard} />
      </div>

      {/* Sub-Agent Panel */}
      <SubAgentPanel onSpawn={spawnSubAgent} onRunEvent={onSubAgentRunEvent} />

      {/* Active Agent Footer */}
      {activeAgent && (
        <div className="p-4 border-t border-border bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Active Agent</div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{activeAgent.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm flex items-center gap-1.5">
                {activeAgent.name}
                {lifecycleMap[activeAgent.id] && lifecycleMap[activeAgent.id] !== 'active' && (
                  <span className={cn('text-[9px] uppercase tracking-wider px-1 py-0.5 rounded-full', LIFECYCLE_COLORS[lifecycleMap[activeAgent.id]])}>
                    {lifecycleMap[activeAgent.id]}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{activeAgent.persona}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
