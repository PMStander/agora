import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { createDailySummary, createWeeklySummary } from '../../lib/memoryIntelligence/memorySummarizer';
import type { MemorySummary, SummaryType } from '../../types/memoryIntelligence';

interface SummariesTabProps {
  agentId: string;
}

const summaryTypeConfig: Record<SummaryType, { label: string; color: string }> = {
  hourly: { label: 'Hourly', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  daily: { label: 'Daily', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  weekly: { label: 'Weekly', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export function SummariesTab({ agentId }: SummariesTabProps) {
  const [summaries, setSummaries] = useState<MemorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<SummaryType | ''>('');

  const loadSummaries = useCallback(async () => {
    if (!isSupabaseConfigured() || !agentId) {
      setLoading(false);
      return;
    }

    let q = supabase
      .from('memory_summaries')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (filterType) {
      q = q.eq('summary_type', filterType);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[SummariesTab] fetch error:', error);
    } else {
      setSummaries((data || []) as MemorySummary[]);
    }
    setLoading(false);
  }, [agentId, filterType]);

  useEffect(() => {
    setLoading(true);
    loadSummaries();
  }, [loadSummaries]);

  const handleGenerate = async (type: 'daily' | 'weekly') => {
    if (!agentId) return;
    setGenerating(type);
    try {
      const result = type === 'daily'
        ? await createDailySummary(agentId)
        : await createWeeklySummary(agentId);

      if (result) {
        await loadSummaries();
      }
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {summaries.length} summar{summaries.length !== 1 ? 'ies' : 'y'}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleGenerate('daily')}
            disabled={!!generating || !agentId}
            className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {generating === 'daily' ? 'Generating...' : 'Daily'}
          </button>
          <button
            onClick={() => handleGenerate('weekly')}
            disabled={!!generating || !agentId}
            className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 disabled:opacity-50 transition-colors"
          >
            {generating === 'weekly' ? 'Generating...' : 'Weekly'}
          </button>
        </div>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilterType('')}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            !filterType
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          All
        </button>
        {(Object.entries(summaryTypeConfig) as [SummaryType, typeof summaryTypeConfig[SummaryType]][]).map(
          ([type, config]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                filterType === type
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {config.label}
            </button>
          )
        )}
      </div>

      {/* Summaries list */}
      {loading ? (
        <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
          Loading summaries...
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-xs text-zinc-400">No summaries yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Generate a daily or weekly summary to condense agent activity
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((summary) => {
            const config = summaryTypeConfig[summary.summary_type] || {
              label: summary.summary_type,
              color: 'bg-zinc-700 text-zinc-400',
            };
            const isExpanded = expandedId === summary.id;
            const periodStart = new Date(summary.period_start).toLocaleDateString();
            const periodEnd = new Date(summary.period_end).toLocaleDateString();

            return (
              <div
                key={summary.id}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-zinc-800/80 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : summary.id)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {periodStart === periodEnd ? periodStart : `${periodStart} — ${periodEnd}`}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>

                  {/* Quick stats */}
                  {summary.stats && (
                    <div className="flex gap-3 mb-1.5">
                      {summary.stats.missions_started != null && summary.stats.missions_started > 0 && (
                        <span className="text-xs text-zinc-500">
                          {summary.stats.missions_started} started
                        </span>
                      )}
                      {summary.stats.missions_completed != null && summary.stats.missions_completed > 0 && (
                        <span className="text-xs text-green-400/60">
                          {summary.stats.missions_completed} completed
                        </span>
                      )}
                    </div>
                  )}

                  {/* Topics */}
                  {summary.topics && summary.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {summary.topics.slice(0, 6).map((topic) => (
                        <span
                          key={topic}
                          className="text-xs px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-400"
                        >
                          {topic}
                        </span>
                      ))}
                      {summary.topics.length > 6 && (
                        <span className="text-xs text-zinc-600">
                          +{summary.topics.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div className="border-t border-zinc-700 p-3 space-y-3 bg-zinc-900/30">
                    {/* Summary text */}
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Summary:</p>
                      <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                        {summary.summary_text}
                      </pre>
                    </div>

                    {/* Decisions */}
                    {summary.decisions && summary.decisions.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Decisions:</p>
                        <div className="space-y-1">
                          {summary.decisions.map((d, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs">
                              <span className="text-amber-500/60 shrink-0">[*]</span>
                              <span className="text-zinc-300">{d.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items */}
                    {summary.action_items && summary.action_items.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Action Items:</p>
                        <div className="space-y-1">
                          {summary.action_items.map((a, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs">
                              <span
                                className={`shrink-0 ${
                                  a.status === 'completed'
                                    ? 'text-green-400'
                                    : a.status === 'in_progress'
                                    ? 'text-amber-400'
                                    : 'text-zinc-500'
                                }`}
                              >
                                {a.status === 'completed' ? '[ok]' : a.status === 'in_progress' ? '[>>]' : '[ ]'}
                              </span>
                              <span className="text-zinc-300">{a.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
