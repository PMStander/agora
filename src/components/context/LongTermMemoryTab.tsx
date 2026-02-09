import { useState, useEffect } from 'react';
import { useAgentMemory } from '../../hooks/useAgentMemory';
import type { LongTermMemory } from '../../types/context';

interface LongTermMemoryTabProps {
  agentId: string;
}

const categoryColors: Record<string, string> = {
  insight: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pattern: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  preference: 'bg-green-500/20 text-green-400 border-green-500/30',
  skill_learned: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  mistake_learned: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function LongTermMemoryTab({ agentId }: LongTermMemoryTabProps) {
  const { getLongTermMemories } = useAgentMemory();
  const [memories, setMemories] = useState<LongTermMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    getLongTermMemories(agentId, filterCategory ? { category: filterCategory } : undefined)
      .then((data) => {
        setMemories(data);
        setLoading(false);
      });
  }, [agentId, filterCategory, getLongTermMemories]);

  const filteredMemories = search
    ? memories.filter(
        (m) =>
          m.title.toLowerCase().includes(search.toLowerCase()) ||
          m.content.toLowerCase().includes(search.toLowerCase()) ||
          m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : memories;

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search memories..."
        className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
      />

      {/* Category filters */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilterCategory('')}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            !filterCategory
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          All
        </button>
        {['insight', 'pattern', 'preference', 'skill_learned', 'mistake_learned'].map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                filterCategory === cat
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          )
        )}
      </div>

      {/* Memory list */}
      {loading ? (
        <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
          Loading memories...
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🧠</div>
          <p className="text-xs text-zinc-400">No long-term memories</p>
          <p className="text-xs text-zinc-600 mt-1">
            Promote daily notes or let the system extract insights
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMemories.map((memory) => (
            <div
              key={memory.id}
              className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded border ${
                    categoryColors[memory.category] || ''
                  }`}
                >
                  {memory.category.replace('_', ' ')}
                </span>
                <span className="text-xs text-zinc-500">
                  relevance: {(memory.relevance_score * 100).toFixed(0)}%
                </span>
              </div>
              <h4 className="text-sm font-medium text-zinc-200">{memory.title}</h4>
              <p className="text-xs text-zinc-400 line-clamp-3">{memory.content}</p>
              {memory.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {memory.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-1 py-0.5 rounded bg-zinc-700 text-zinc-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-zinc-600">
                {new Date(memory.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
