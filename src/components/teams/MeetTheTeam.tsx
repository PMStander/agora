import { useAgentStore } from '../../stores/agents';
import { TeamSection } from './TeamSection';

// Display teams in this order: orchestrator → personal → business → engineering
const TEAM_ORDER = ['orchestrator', 'personal', 'business', 'engineering'];

export function MeetTheTeam() {
  const teams = useAgentStore((s) => s.teams);

  const sortedTeams = [...teams].sort((a, b) => {
    const ai = TEAM_ORDER.indexOf(a.id);
    const bi = TEAM_ORDER.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const totalAgents = teams.reduce((sum, t) => sum + t.agents.length, 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">Meet the Team</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {teams.length} team{teams.length !== 1 ? 's' : ''} &middot; {totalAgents} agent{totalAgents !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Team sections */}
        {sortedTeams.map((team) => (
          <TeamSection key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}
