import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { extractFeedbackPatterns } from '../../lib/memoryIntelligence/feedbackPatterns';
import type { AgentLearnedPattern, PatternType } from '../../types/memoryIntelligence';

interface LearnedPatternsTabProps {
  agentId: string;
}

const patternTypeConfig: Record<PatternType, { label: string; icon: string; color: string }> = {
  mistake: { label: 'Mistake', icon: '[x]', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  rejection_reason: { label: 'Rejection', icon: '[!]', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  preference: { label: 'Preference', icon: '[*]', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  success_pattern: { label: 'Success', icon: '[ok]', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  style_guide: { label: 'Style', icon: '[~]', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export function LearnedPatternsTab({ agentId }: LearnedPatternsTabProps) {
  const [patterns, setPatterns] = useState<AgentLearnedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPatterns = useCallback(async () => {
    if (!isSupabaseConfigured() || !agentId) {
      setLoading(false);
      return;
    }

    let q = supabase
      .from('agent_learned_patterns')
      .select('*')
      .eq('agent_id', agentId)
      .eq('active', true)
      .order('confidence', { ascending: false });

    if (filterType) {
      q = q.eq('pattern_type', filterType);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[LearnedPatternsTab] fetch error:', error);
    } else {
      setPatterns((data || []) as AgentLearnedPattern[]);
    }
    setLoading(false);
  }, [agentId, filterType]);

  useEffect(() => {
    setLoading(true);
    loadPatterns();
  }, [loadPatterns]);

  const handleExtract = async () => {
    if (!agentId) return;
    setExtracting(true);
    try {
      const newPatterns = await extractFeedbackPatterns(agentId);
      if (newPatterns.length > 0) {
        await loadPatterns();
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleToggleActive = async (pattern: AgentLearnedPattern) => {
    const { error } = await supabase
      .from('agent_learned_patterns')
      .update({ active: !pattern.active, updated_at: new Date().toISOString() })
      .eq('id', pattern.id);

    if (!error) {
      setPatterns(prev => prev.filter(p => p.id !== pattern.id));
    }
  };

  return (
    <div className="space-y-3">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {patterns.length} active pattern{patterns.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleExtract}
          disabled={extracting || !agentId}
          className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
        >
          {extracting ? 'Extracting...' : 'Extract from reviews'}
        </button>
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
        {(Object.entries(patternTypeConfig) as [PatternType, typeof patternTypeConfig[PatternType]][]).map(
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

      {/* Pattern list */}
      {loading ? (
        <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
          Loading learned patterns...
        </div>
      ) : patterns.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🎓</div>
          <p className="text-xs text-zinc-400">No learned patterns yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Click "Extract from reviews" to analyze review feedback,
            <br />or patterns are auto-extracted from task approvals/rejections
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {patterns.map((pattern) => {
            const config = patternTypeConfig[pattern.pattern_type] || {
              label: pattern.pattern_type,
              icon: '[?]',
              color: 'bg-zinc-700 text-zinc-400',
            };
            const isExpanded = expandedId === pattern.id;

            return (
              <div
                key={pattern.id}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-zinc-800/80 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : pattern.id)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-500">{config.icon}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600">
                        {pattern.source_count}x seen
                      </span>
                      <span
                        className={`text-xs font-mono ${
                          pattern.confidence >= 0.7
                            ? 'text-green-400'
                            : pattern.confidence >= 0.4
                            ? 'text-amber-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {(pattern.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300">
                    {pattern.pattern}
                  </p>
                </div>

                {/* Expanded: examples + actions */}
                {isExpanded && (
                  <div className="border-t border-zinc-700 px-3 py-2 space-y-2 bg-zinc-900/30">
                    {pattern.examples && pattern.examples.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Recent examples:</p>
                        <div className="space-y-1">
                          {pattern.examples.slice(-3).map((ex, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span
                                className={`shrink-0 px-1 py-0.5 rounded ${
                                  ex.outcome === 'approved'
                                    ? 'bg-green-500/20 text-green-400'
                                    : ex.outcome === 'rejected'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                {ex.outcome}
                              </span>
                              <span className="text-zinc-400 line-clamp-1">{ex.context}</span>
                              <span className="text-zinc-600 shrink-0">
                                {new Date(ex.date).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-zinc-600">
                        Since {new Date(pattern.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(pattern);
                        }}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        Dismiss pattern
                      </button>
                    </div>
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
