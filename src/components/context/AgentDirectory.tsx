import { useState } from 'react';
import { useAgentRegistry } from '../../hooks/useAgentRegistry';
import { AgentDirectoryCard } from './AgentDirectoryCard';
import { ExpertSearchBar } from './ExpertSearchBar';

export function AgentDirectory() {
  const { agents, loading } = useAgentRegistry();
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  const filteredAgents =
    filterAvailability === 'all'
      ? agents
      : agents.filter((a) => a.availability === filterAvailability);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">Agent Directory</h2>
          <span className="text-xs text-zinc-500">{agents.length} agents</span>
        </div>

        {/* Expert search */}
        <ExpertSearchBar />

        {/* Availability filter */}
        <div className="flex gap-1 mt-3">
          {['all', 'available', 'busy', 'offline'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterAvailability(status)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filterAvailability === status
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="text-center text-zinc-500 text-sm py-8 animate-pulse">
            Loading agents...
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">👥</div>
            <p className="text-sm text-zinc-400">No agents found</p>
            <p className="text-xs text-zinc-600 mt-1">
              Agents will appear here once registered in the database
            </p>
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <AgentDirectoryCard key={agent.agent_id} agent={agent} />
          ))
        )}
      </div>
    </div>
  );
}
