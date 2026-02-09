import { useEffect, useState } from 'react';
import { useAgentStore, type Agent } from '../../stores/agents';
import type { SubAgentRunEvent } from '../../hooks/useOpenClaw';
import { cn } from '../../lib/utils';

interface SubAgentRun {
  id: string;
  agentId: string;
  agentName: string;
  task: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  startTime: Date;
  result?: string;
}

interface SubAgentPanelProps {
  onSpawn: (runId: string, agentId: string, task: string) => Promise<void>;
  onRunEvent: (handler: (event: SubAgentRunEvent) => void) => () => void;
}

export function SubAgentPanel({ onSpawn, onRunEvent }: SubAgentPanelProps) {
  const { teams } = useAgentStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [task, setTask] = useState('');
  const [runs, setRuns] = useState<SubAgentRun[]>([]);
  const [isSpawning, setIsSpawning] = useState(false);

  // Flatten all agents for selection
  const allAgents = teams.flatMap(t => t.agents);

  useEffect(() => {
    return onRunEvent((event) => {
      setRuns((prev) => prev.map((run) => {
        if (run.id !== event.runId) return run;
        return {
          ...run,
          status: event.state,
          result: event.text ?? event.error ?? run.result,
        };
      }));
    });
  }, [onRunEvent]);

  const handleSpawn = async () => {
    if (!selectedAgent || !task.trim()) return;
    
    setIsSpawning(true);
    const runId = crypto.randomUUID();
    
    // Add to runs list
    const newRun: SubAgentRun = {
      id: runId,
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      task: task.trim(),
      status: 'queued',
      startTime: new Date(),
    };
    setRuns(prev => [newRun, ...prev]);
    
    try {
      await onSpawn(runId, selectedAgent.id, task.trim());
    } catch {
      setRuns(prev => prev.map(r => 
        r.id === runId ? { ...r, status: 'error' as const } : r
      ));
    } finally {
      setIsSpawning(false);
      setTask('');
    }
  };

  return (
    <div className="border-t border-border">
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>⚡</span>
          <span>Sub-Agents</span>
          {runs.filter(r => r.status === 'queued' || r.status === 'running').length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
              {runs.filter(r => r.status === 'queued' || r.status === 'running').length} active
            </span>
          )}
        </span>
        <span className={cn(
          'transition-transform',
          isExpanded ? 'rotate-180' : ''
        )}>
          ▼
        </span>
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Spawn Form */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={selectedAgent?.id || ''}
                onChange={(e) => {
                  const agent = allAgents.find(a => a.id === e.target.value);
                  setSelectedAgent(agent || null);
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select agent...</option>
                {teams.map(team => (
                  <optgroup key={team.id} label={`${team.emoji} ${team.name}`}>
                    {team.agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.emoji} {agent.name} - {agent.role}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Mission for sub-agent..."
                className="flex-1 px-3 py-2 rounded-lg bg-muted text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleSpawn()}
              />
              <button
                onClick={handleSpawn}
                disabled={!selectedAgent || !task.trim() || isSpawning}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {isSpawning ? '...' : 'Spawn'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Status updates stream from agent run events.
          </p>

          {/* Active Runs */}
          {runs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Recent Runs
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {runs.slice(0, 5).map(run => (
                  <div
                    key={run.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 text-sm"
                  >
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      run.status === 'queued' && 'bg-blue-500',
                      run.status === 'running' && 'bg-yellow-500 animate-pulse',
                      run.status === 'completed' && 'bg-green-500',
                      run.status === 'error' && 'bg-red-500'
                    )} />
                    <span className="font-medium">{run.agentName}</span>
                    <span className="text-muted-foreground truncate flex-1">
                      {run.task}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {run.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
