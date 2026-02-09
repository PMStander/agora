import { useState, useCallback } from 'react';
import { semanticSearch } from '../../lib/memoryIntelligence/embeddingService';
import type { SemanticSearchResult, EmbeddingSourceType } from '../../types/memoryIntelligence';

interface SemanticSearchTabProps {
  agentId: string;
}

const sourceTypeLabels: Record<EmbeddingSourceType, { label: string; color: string }> = {
  daily_note: { label: 'Daily Note', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  long_term_memory: { label: 'Long-term', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  context_document: { label: 'Context', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  mission_output: { label: 'Mission', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  chat_message: { label: 'Chat', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  review_feedback: { label: 'Review', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export function SemanticSearchTab({ agentId }: SemanticSearchTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [agentOnly, setAgentOnly] = useState(true);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await semanticSearch(query, {
        agentId: agentOnly ? agentId : undefined,
        threshold: 0.2,
        limit: 20,
      });
      setResults(data);
    } catch (err) {
      console.error('[SemanticSearchTab] search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, agentId, agentOnly]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search across all memories..."
          className="flex-1 px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={agentOnly}
            onChange={(e) => setAgentOnly(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/30 w-3 h-3"
          />
          Agent only
        </label>
        {searched && (
          <span className="text-xs text-zinc-600">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
          Searching memory embeddings...
        </div>
      ) : !searched ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-xs text-zinc-400">Semantic vector search</p>
          <p className="text-xs text-zinc-600 mt-1">
            Search across all embedded memories using cosine similarity
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🤷</div>
          <p className="text-xs text-zinc-400">No matching memories found</p>
          <p className="text-xs text-zinc-600 mt-1">
            Try a different query or uncheck "Agent only" to search all agents
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((result) => {
            const sourceInfo = sourceTypeLabels[result.source_type] || {
              label: result.source_type,
              color: 'bg-zinc-700 text-zinc-400',
            };
            const similarityPct = (result.similarity * 100).toFixed(0);

            return (
              <div
                key={result.id}
                className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${sourceInfo.color}`}
                    >
                      {sourceInfo.label}
                    </span>
                    {result.agent_id && (
                      <span className="text-xs text-zinc-600">
                        {result.agent_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-1 rounded-full bg-zinc-700 overflow-hidden"
                      style={{ width: '40px' }}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${
                          Number(similarityPct) >= 70
                            ? 'bg-green-500'
                            : Number(similarityPct) >= 40
                            ? 'bg-amber-500'
                            : 'bg-zinc-500'
                        }`}
                        style={{ width: `${similarityPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 font-mono w-8 text-right">
                      {similarityPct}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 line-clamp-4 whitespace-pre-wrap">
                  {result.content_text}
                </p>
                {result.metadata && Object.keys(result.metadata).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(result.metadata).slice(0, 4).map(([key, val]) => (
                      <span
                        key={key}
                        className="text-xs px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-500"
                      >
                        {key}: {String(val).slice(0, 30)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
