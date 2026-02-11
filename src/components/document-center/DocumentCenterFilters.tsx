import { useState, useEffect } from 'react';
import { useDocumentCenterStore } from '../../stores/documentCenter';
import { useAgentStore } from '../../stores/agents';
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS_CONFIG, type DocumentCenterStatus } from '../../types/documentCenter';

export function DocumentCenterFilters() {
  const filters = useDocumentCenterStore((s) => s.filters);
  const setCategory = useDocumentCenterStore((s) => s.setCategory);
  const setStatus = useDocumentCenterStore((s) => s.setStatus);
  const setSearch = useDocumentCenterStore((s) => s.setSearch);
  const setSort = useDocumentCenterStore((s) => s.setSort);
  const setAgentFilter = useDocumentCenterStore((s) => s.setAgentFilter);
  const resetFilters = useDocumentCenterStore((s) => s.resetFilters);

  const allAgents = useAgentStore((s) => s.teams).flatMap((t) => t.agents);

  // Debounced search
  const [localSearch, setLocalSearch] = useState(filters.search);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearch]);

  const hasFilters = filters.category !== 'all' || filters.status !== 'all' || filters.search || filters.agentId;

  return (
    <div className="px-4 py-3 border-b border-zinc-800 space-y-3">
      {/* Category pills */}
      <div className="flex flex-wrap gap-1">
        {DOCUMENT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`
              px-3 py-1 text-xs font-medium rounded-full transition-colors
              ${filters.category === cat.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }
            `}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Second row: search + dropdowns */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="flex-1 relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => setStatus(e.target.value as DocumentCenterStatus | 'all')}
          className="px-2 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 focus:outline-none focus:border-amber-500/50"
        >
          <option value="all">All Status</option>
          {(Object.entries(DOCUMENT_STATUS_CONFIG) as Array<[DocumentCenterStatus, { label: string }]>).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        {/* Agent filter */}
        <select
          value={filters.agentId ?? ''}
          onChange={(e) => setAgentFilter(e.target.value || null)}
          className="px-2 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 focus:outline-none focus:border-amber-500/50"
        >
          <option value="">All Agents</option>
          {allAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.emoji} {agent.name}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => setSort(e.target.value as typeof filters.sort)}
          className="px-2 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 focus:outline-none focus:border-amber-500/50"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="recently_updated">Updated</option>
          <option value="title_asc">A-Z</option>
          <option value="title_desc">Z-A</option>
        </select>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={resetFilters}
            className="text-xs text-zinc-500 hover:text-amber-400 transition-colors whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
