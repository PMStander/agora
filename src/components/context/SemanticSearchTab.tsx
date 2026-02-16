import { useState, useCallback } from 'react';
import { semanticSearch } from '../../lib/memoryIntelligence/embeddingService';
import { searchEntities } from '../../lib/embeddingSearch';
import type { SemanticSearchResult, EmbeddingSourceType } from '../../types/memoryIntelligence';
import type { EntitySearchResult, EmbeddableEntityType } from '../../types/entityEmbeddings';

interface SemanticSearchTabProps {
  agentId: string;
}

type SearchMode = 'memories' | 'entities';

// Unified result type for rendering
interface UnifiedResult {
  id: string;
  badge: string;
  badgeColor: string;
  similarity: number;
  content_text: string;
  metadata?: Record<string, unknown>;
  subtitle?: string;
}

const sourceTypeLabels: Record<EmbeddingSourceType, { label: string; color: string }> = {
  daily_note: { label: 'Daily Note', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  long_term_memory: { label: 'Long-term', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  context_document: { label: 'Context', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  mission_output: { label: 'Mission', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  chat_message: { label: 'Chat', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  review_feedback: { label: 'Review', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const entityTypeLabels: Partial<Record<EmbeddableEntityType, { label: string; color: string }>> = {
  company: { label: 'Company', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  contact: { label: 'Contact', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  deal: { label: 'Deal', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  product: { label: 'Product', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  product_category: { label: 'Category', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  project: { label: 'Project', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  mission: { label: 'Mission', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  task: { label: 'Task', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  order: { label: 'Order', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  quote: { label: 'Quote', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
  invoice: { label: 'Invoice', color: 'bg-lime-500/20 text-lime-400 border-lime-500/30' },
  email: { label: 'Email', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  email_template: { label: 'Template', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  calendar_event: { label: 'Event', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  workflow: { label: 'Workflow', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  workflow_sequence: { label: 'Sequence', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  document: { label: 'Document', color: 'bg-stone-500/20 text-stone-400 border-stone-500/30' },
  crm_document: { label: 'Document', color: 'bg-stone-500/20 text-stone-400 border-stone-500/30' },
  agent: { label: 'Agent', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  boardroom_message: { label: 'Boardroom', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  notification: { label: 'Notification', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  interaction: { label: 'Interaction', color: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30' },
};

function normalizeMemoryResult(r: SemanticSearchResult): UnifiedResult {
  const info = sourceTypeLabels[r.source_type] || { label: r.source_type, color: 'bg-zinc-700 text-zinc-400' };
  return {
    id: r.id,
    badge: info.label,
    badgeColor: info.color,
    similarity: r.similarity,
    content_text: r.content_text,
    metadata: r.metadata,
    subtitle: r.agent_id?.slice(0, 8),
  };
}

function normalizeEntityResult(r: EntitySearchResult): UnifiedResult {
  const info = entityTypeLabels[r.entity_type] || { label: r.entity_type, color: 'bg-zinc-700 text-zinc-400' };
  return {
    id: r.id,
    badge: info.label,
    badgeColor: info.color,
    similarity: r.similarity,
    content_text: r.content_text,
    metadata: r.metadata,
  };
}

export function SemanticSearchTab({ agentId }: SemanticSearchTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [agentOnly, setAgentOnly] = useState(true);
  const [mode, setMode] = useState<SearchMode>('entities');

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      if (mode === 'memories') {
        const data = await semanticSearch(query, {
          agentId: agentOnly ? agentId : undefined,
          threshold: 0.2,
          limit: 20,
        });
        setResults(data.map(normalizeMemoryResult));
      } else {
        const data = await searchEntities(query, {
          limit: 20,
          threshold: 0.2,
          hybrid: true,
        });
        setResults(data.map(normalizeEntityResult));
      }
    } catch (err) {
      console.error('[SemanticSearchTab] search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, agentId, agentOnly, mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
        <button
          onClick={() => { setMode('entities'); setSearched(false); setResults([]); }}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'entities'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Entities
        </button>
        <button
          onClick={() => { setMode('memories'); setSearched(false); setResults([]); }}
          className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'memories'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Memories
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'entities' ? 'Search companies, deals, projects...' : 'Search across agent memories...'}
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

      {/* Scope toggle (memories only) */}
      <div className="flex items-center gap-2">
        {mode === 'memories' && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={agentOnly}
              onChange={(e) => setAgentOnly(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/30 w-3 h-3"
            />
            Agent only
          </label>
        )}
        {searched && (
          <span className="text-xs text-zinc-600">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
          {mode === 'entities' ? 'Searching entity embeddings...' : 'Searching memory embeddings...'}
        </div>
      ) : !searched ? (
        <div className="text-center py-8">
          <svg className="w-6 h-6 mx-auto mb-2 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <p className="text-xs text-zinc-400">
            {mode === 'entities' ? 'Semantic entity search' : 'Semantic memory search'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            {mode === 'entities'
              ? 'Search across all CRM, products, projects, and more via Gemini embeddings'
              : 'Search across embedded memories using cosine similarity'}
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-6 h-6 mx-auto mb-2 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
          </svg>
          <p className="text-xs text-zinc-400">No matches found</p>
          <p className="text-xs text-zinc-600 mt-1">
            {mode === 'entities'
              ? 'Try a different query or check that entities have been embedded'
              : 'Try a different query or uncheck "Agent only" to search all agents'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((result) => {
            const similarityPct = (result.similarity * 100).toFixed(0);

            return (
              <div
                key={result.id}
                className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${result.badgeColor}`}
                    >
                      {result.badge}
                    </span>
                    {result.subtitle && (
                      <span className="text-xs text-zinc-600">
                        {result.subtitle}
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
