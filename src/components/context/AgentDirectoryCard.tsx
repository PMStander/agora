import type { AgentRegistryEntry } from '../../types/context';

interface AgentDirectoryCardProps {
  agent: AgentRegistryEntry;
  onSelect?: (agentId: string) => void;
}

const availabilityColors: Record<string, string> = {
  available: 'bg-green-500',
  busy: 'bg-yellow-500',
  offline: 'bg-zinc-500',
};

const levelLabels: Record<number, string> = {
  1: 'Junior',
  2: 'Mid',
  3: 'Senior',
  4: 'Lead',
  5: 'Principal',
};

export function AgentDirectoryCard({ agent, onSelect }: AgentDirectoryCardProps) {
  return (
    <button
      onClick={() => onSelect?.(agent.agent_id)}
      className="w-full text-left p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Availability dot */}
        <div className="mt-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              availabilityColors[agent.availability] || 'bg-zinc-500'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + level */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {agent.display_name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
              L{agent.level} {levelLabels[agent.level] || ''}
            </span>
          </div>

          {/* Role */}
          <p className="text-xs text-zinc-500 mt-0.5">{agent.role}</p>

          {/* Skills */}
          {agent.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {agent.skills.slice(0, 5).map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/20"
                >
                  {skill}
                </span>
              ))}
              {agent.skills.length > 5 && (
                <span className="text-xs text-zinc-500">
                  +{agent.skills.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <span>
              Quality: {(agent.avg_quality_score * 100).toFixed(0)}%
            </span>
            <span>
              Missions: {agent.total_missions_completed}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
