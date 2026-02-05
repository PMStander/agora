import { useAgentStore, useActiveAgent, type Agent, type Team } from '../../stores/agents';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import { SubAgentPanel } from './SubAgentPanel';
import { cn } from '../../lib/utils';

interface AgentItemProps {
  agent: Agent;
  isActive: boolean;
  onClick: () => void;
}

function AgentItem({ agent, isActive, onClick }: AgentItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      )}
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
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{agent.name}</div>
        <div className="text-xs text-muted-foreground truncate">{agent.role}</div>
      </div>
    </button>
  );
}

interface TeamSectionProps {
  team: Team;
  activeAgentId: string;
  onAgentSelect: (agentId: string) => void;
}

function TeamSection({ team, activeAgentId, onAgentSelect }: TeamSectionProps) {
  return (
    <div className="space-y-1">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <span>{team.emoji}</span>
        <span>{team.name}</span>
      </div>
      <div className="space-y-1">
        {team.agents.map((agent) => (
          <AgentItem
            key={agent.id}
            agent={agent}
            isActive={agent.id === activeAgentId}
            onClick={() => onAgentSelect(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface AgentSidebarProps {
  onSettingsClick?: () => void;
}

export function AgentSidebar({ onSettingsClick }: AgentSidebarProps) {
  const { teams, activeAgentId, setActiveAgent, isConnected } = useAgentStore();
  const { spawnSubAgent } = useOpenClaw();
  const activeAgent = useActiveAgent();

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
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                )}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
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
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {teams.map((team) => (
          <TeamSection
            key={team.id}
            team={team}
            activeAgentId={activeAgentId}
            onAgentSelect={setActiveAgent}
          />
        ))}
      </div>

      {/* Sub-Agent Panel */}
      <SubAgentPanel onSpawn={spawnSubAgent} />

      {/* Active Agent Footer */}
      {activeAgent && (
        <div className="p-4 border-t border-border bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Active Agent</div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{activeAgent.emoji}</span>
            <div>
              <div className="font-medium text-sm">{activeAgent.name}</div>
              <div className="text-xs text-muted-foreground">{activeAgent.persona}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
