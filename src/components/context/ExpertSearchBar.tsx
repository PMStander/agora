import { useState } from 'react';
import type { AgentRegistryEntry } from '../../types/context';
import { useAgentRegistry } from '../../hooks/useAgentRegistry';
import { AgentDirectoryCard } from './AgentDirectoryCard';

interface ExpertSearchBarProps {
  onSelect?: (agentId: string) => void;
}

export function ExpertSearchBar({ onSelect }: ExpertSearchBarProps) {
  const { findExpert } = useAgentRegistry();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AgentRegistryEntry[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const found = await findExpert({
      domain: query.trim(),
      skill: query.trim(),
    });
    setResults(found);
    setSearching(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by domain or skill..."
          className="flex-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-3 py-1.5 text-xs font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
        >
          {searching ? '...' : 'Find'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((agent) => (
            <AgentDirectoryCard
              key={agent.agent_id}
              agent={agent}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
