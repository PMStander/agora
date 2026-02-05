import { useAgentStore } from '../../stores/agents';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import { cn } from '../../lib/utils';

export function StatusBar() {
  const { isLoading, teams } = useAgentStore();
  const { isConnected, isConnecting, connectionError, connect } = useOpenClaw();
  
  const totalAgents = teams.reduce((acc, t) => acc + t.agents.length, 0);

  const handleReconnect = () => {
    connect().catch(console.error);
  };

  return (
    <div className="h-6 bg-card border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            )}
          />
          <span>
            {isConnected 
              ? 'Connected to OpenClaw' 
              : isConnecting 
                ? 'Connecting...' 
                : connectionError 
                  ? `Error: ${connectionError}` 
                  : 'Disconnected'}
          </span>
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
      </div>
      
      <div className="flex items-center gap-4">
        {isLoading && (
          <span className="text-primary animate-pulse">Processing...</span>
        )}
        <span>⌘⇧A: Toggle</span>
        <span>⌘,: Settings</span>
      </div>
    </div>
  );
}
