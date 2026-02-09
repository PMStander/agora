import { useAgentStore } from '../../stores/agents';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import { useMissionControlStore } from '../../stores/missionControl';
import { cn } from '../../lib/utils';
import { openclawClient } from '../../lib/openclawClient';

export function StatusBar() {
  const { isLoading, teams, activeAgentId } = useAgentStore();
  const { isConnected, isConnecting, connectionError, connect } = useOpenClaw();
  const connectionQuality = useMissionControlStore((s) => s.connectionQuality);
  const reconnecting = useMissionControlStore((s) => s.reconnecting);

  const totalAgents = teams.reduce((acc, t) => acc + t.agents.length, 0);
  const activeTeam = teams.find((team) => team.agents.some((agent) => agent.id === activeAgentId));
  const activeAgent = activeTeam?.agents.find((agent) => agent.id === activeAgentId);
  const activeRoute = activeTeam && activeAgent
    ? `${activeTeam.emoji} ${activeTeam.name} -> ${activeAgent.name}`
    : 'Unknown route';

  const handleReconnect = () => {
    openclawClient.resetReconnectAttempts();
    connect().catch(console.error);
  };

  // Determine the dot color based on connection status + quality
  const dotColor = !isConnected
    ? isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
    : connectionQuality === 'good'
    ? 'bg-green-500'
    : connectionQuality === 'degraded'
    ? 'bg-yellow-500 animate-pulse'
    : 'bg-red-500 animate-pulse';

  // Determine the quality badge
  const qualityBadge = isConnected && connectionQuality === 'good'
    ? { text: 'Live', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    : isConnected && connectionQuality === 'degraded'
    ? { text: 'Degraded', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' }
    : isConnected && connectionQuality === 'lost'
    ? { text: 'Lost', className: 'bg-red-500/10 text-red-400 border-red-500/20' }
    : null;

  return (
    <div className="h-6 bg-card border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', dotColor)} />
          <span>
            {reconnecting
              ? `Reconnecting... (attempt ${openclawClient.reconnectAttempt})`
              : isConnected
              ? 'Connected to OpenClaw'
              : isConnecting
                ? 'Connecting...'
                : connectionError
                  ? `Error: ${connectionError}`
                  : 'Disconnected'}
          </span>
          {qualityBadge && (
            <span className={cn('ml-1 px-1.5 py-0.5 rounded border', qualityBadge.className)}>
              {qualityBadge.text}
            </span>
          )}
          {!isConnected && !isConnecting && (
            <button
              onClick={handleReconnect}
              className="text-primary hover:underline ml-1"
            >
              Retry
            </button>
          )}
        </div>
        <span>|</span>
        <span>{totalAgents} agents</span>
        <span>|</span>
        <span>{teams.length} teams</span>
        <span>|</span>
        <span title="Current routing context for chat sessions">Route: {activeRoute}</span>
      </div>

      <div className="flex items-center gap-4">
        {isLoading && (
          <span className="text-primary animate-pulse">Processing...</span>
        )}
        <span>⌘⇧O/P/B: Route</span>
        <span>⌘⇧A: Toggle</span>
        <span>⌘,: Settings</span>
      </div>
    </div>
  );
}
