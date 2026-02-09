import type { AgentPerformanceRow } from '../../types/reports';

interface Props {
  data: AgentPerformanceRow[];
}

export function AgentLeaderboard({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Agent Leaderboard</h3>
        <p className="text-zinc-500 text-sm">No agent performance data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Agent Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2 pr-4 text-zinc-500 font-medium">#</th>
              <th className="text-left py-2 pr-4 text-zinc-500 font-medium">Agent</th>
              <th className="text-right py-2 pr-4 text-zinc-500 font-medium">Deals Won</th>
              <th className="text-right py-2 pr-4 text-zinc-500 font-medium">Revenue</th>
              <th className="text-right py-2 text-zinc-500 font-medium">Missions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.agent_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-2 pr-4 text-zinc-500">{i + 1}</td>
                <td className="py-2 pr-4 text-zinc-300 font-medium">{row.agent_id}</td>
                <td className="py-2 pr-4 text-right text-amber-400 font-semibold">{row.deals_won}</td>
                <td className="py-2 pr-4 text-right text-zinc-300">
                  ${Number(row.total_revenue).toLocaleString()}
                </td>
                <td className="py-2 text-right text-zinc-400">{row.missions_completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
