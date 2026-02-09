import { useState, useEffect, useCallback } from 'react';
import {
  getPriorities,
  setPriority,
  completePriority,
  reorderPriorities,
} from '../../lib/memoryIntelligence/priorityStack';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { SharedPriority, PriorityScope } from '../../types/memoryIntelligence';

interface PrioritiesTabProps {
  agentId: string;
}

const scopeColors: Record<PriorityScope, string> = {
  global: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  team: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  agent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export function PrioritiesTab({ agentId }: PrioritiesTabProps) {
  const [priorities, setPrioritiesState] = useState<SharedPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterScope, setFilterScope] = useState<PriorityScope | ''>('');

  // New priority form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newScope, setNewScope] = useState<PriorityScope>('global');
  const [adding, setAdding] = useState(false);

  const loadPriorities = useCallback(async () => {
    const data = await getPriorities(
      filterScope || undefined,
      undefined
    );
    setPrioritiesState(data);
    setLoading(false);
  }, [filterScope]);

  useEffect(() => {
    setLoading(true);
    loadPriorities();
  }, [loadPriorities]);

  // Realtime subscription
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('priorities-viewer')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shared_priorities' },
        () => loadPriorities()
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [loadPriorities]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    const result = await setPriority(
      newTitle.trim(),
      newDescription.trim() || undefined,
      newScope,
      newScope === 'agent' ? agentId : undefined,
      'user'
    );
    if (result) {
      setNewTitle('');
      setNewDescription('');
      setShowForm(false);
      await loadPriorities();
    }
    setAdding(false);
  };

  const handleComplete = async (id: string) => {
    const success = await completePriority(id);
    if (success) {
      setPrioritiesState(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const ids = priorities.map(p => p.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    await reorderPriorities(ids);
    await loadPriorities();
  };

  const handleMoveDown = async (index: number) => {
    if (index >= priorities.length - 1) return;
    const ids = priorities.map(p => p.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    await reorderPriorities(ids);
    await loadPriorities();
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {priorities.length} active priorit{priorities.length !== 1 ? 'ies' : 'y'}
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Priority title..."
            className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(['global', 'team', 'agent'] as PriorityScope[]).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setNewScope(scope)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    newScope === scope
                      ? scopeColors[scope]
                      : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {scope}
                </button>
              ))}
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newTitle.trim()}
              className="px-3 py-1 text-xs bg-amber-500 text-zinc-900 font-medium rounded hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {adding ? 'Adding...' : 'Add Priority'}
            </button>
          </div>
        </div>
      )}

      {/* Scope filters */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilterScope('')}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            !filterScope
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          All
        </button>
        {(['global', 'team', 'agent'] as PriorityScope[]).map((scope) => (
          <button
            key={scope}
            onClick={() => setFilterScope(scope)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              filterScope === scope
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {scope}
          </button>
        ))}
      </div>

      {/* Priority list */}
      {loading ? (
        <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
          Loading priorities...
        </div>
      ) : priorities.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🎯</div>
          <p className="text-xs text-zinc-400">No active priorities</p>
          <p className="text-xs text-zinc-600 mt-1">
            Add priorities to guide agent focus and decision-making
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {priorities.map((priority, index) => (
            <div
              key={priority.id}
              className="group p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start gap-2">
                {/* Rank */}
                <span className="text-xs font-mono text-amber-500/60 w-5 pt-0.5 text-center shrink-0">
                  {priority.priority_rank}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-zinc-200">
                      {priority.title}
                    </span>
                    <span className={`text-xs px-1 py-0.5 rounded border ${scopeColors[priority.scope]}`}>
                      {priority.scope}
                    </span>
                  </div>
                  {priority.description && (
                    <p className="text-xs text-zinc-400">{priority.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-600">
                      Set by {priority.set_by}
                    </span>
                    <span className="text-xs text-zinc-600">
                      {new Date(priority.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions - visible on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index >= priorities.length - 1}
                    className="p-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30"
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => handleComplete(priority.id)}
                    className="p-1 text-xs text-zinc-500 hover:text-green-400 transition-colors"
                    title="Complete"
                  >
                    ✓
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
