import type { Team } from '../../stores/agents';
import { AgentCard } from './AgentCard';

interface TeamSectionProps {
  team: Team;
}

export function TeamSection({ team }: TeamSectionProps) {
  return (
    <div className="mb-8">
      {/* Team header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{team.emoji}</span>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">{team.name}</h3>
          <p className="text-xs text-zinc-500">{team.theme} &middot; {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {team.agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
