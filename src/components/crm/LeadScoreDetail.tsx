import { useEffect, useState } from 'react';
import { useLeadScoring, type ScoreBreakdown } from '../../hooks/useLeadScoring';
import { LEAD_SCORE_CONFIG, type Contact, type LeadScoreLabel } from '../../types/crm';
import { LeadScoreBadge } from './LeadScoreBadge';

interface LeadScoreDetailProps {
  contact: Contact;
}

export function LeadScoreDetail({ contact }: LeadScoreDetailProps) {
  const { computeScore, recalculateScore, overrideScore, fetchHistory, history } = useLeadScoring();
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  // Compute breakdown whenever contact changes
  useEffect(() => {
    setBreakdown(computeScore(contact));
  }, [contact, computeScore]);

  const handleRecalculate = async () => {
    const result = await recalculateScore(contact);
    setBreakdown(result);
  };

  const handleOverride = async () => {
    const score = parseInt(overrideInput, 10);
    if (isNaN(score) || score < 0 || score > 100) return;
    const thresholds = { hot: 80, warm: 50, cold: 20 };
    const label: LeadScoreLabel = score >= thresholds.hot ? 'hot' : score >= thresholds.warm ? 'warm' : 'cold';
    await overrideScore(contact.id, score, label);
    setBreakdown({ ...breakdown!, total: score, label });
    setOverrideInput('');
    setShowOverride(false);
  };

  const handleToggleHistory = () => {
    if (!showHistory) fetchHistory(contact.id);
    setShowHistory(!showHistory);
  };

  if (!breakdown) return null;

  const matchedItems = breakdown.items.filter((i) => i.matched);
  const unmatchedItems = breakdown.items.filter((i) => !i.matched);

  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
        Lead Score
      </h4>

      {/* Score summary */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <LeadScoreBadge score={contact.lead_score ?? breakdown.total} label={contact.lead_score_label as LeadScoreLabel ?? breakdown.label} />
          <span className={`text-sm font-medium ${LEAD_SCORE_CONFIG[breakdown.label].textClass}`}>
            {LEAD_SCORE_CONFIG[breakdown.label].label}
          </span>
        </div>
        {/* Score bar */}
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              breakdown.label === 'hot'
                ? 'bg-red-500'
                : breakdown.label === 'warm'
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, breakdown.total)}%` }}
          />
        </div>
      </div>

      {/* Matched rules */}
      {matchedItems.length > 0 && (
        <div className="space-y-1 mb-2">
          {matchedItems.map((item) => (
            <div key={item.ruleLabel} className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">{item.ruleLabel}</span>
              <span className="text-green-400 font-mono">+{item.points}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unmatched rules (collapsed) */}
      {unmatchedItems.length > 0 && (
        <details className="mb-2">
          <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-500 transition-colors">
            {unmatchedItems.length} unmatched rules
          </summary>
          <div className="space-y-1 mt-1">
            {unmatchedItems.map((item) => (
              <div key={item.ruleLabel} className="flex items-center justify-between text-xs">
                <span className="text-zinc-600">{item.ruleLabel}</span>
                <span className="text-zinc-700 font-mono">+{item.points}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 mt-3">
        <button
          onClick={handleRecalculate}
          className="px-2 py-1 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          Recalculate
        </button>
        <button
          onClick={() => setShowOverride(!showOverride)}
          className="px-2 py-1 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          Override
        </button>
        <button
          onClick={handleToggleHistory}
          className="px-2 py-1 text-[10px] bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          {showHistory ? 'Hide' : 'History'}
        </button>
      </div>

      {/* Override input */}
      {showOverride && (
        <div className="flex gap-1.5 mt-2">
          <input
            type="number"
            min={0}
            max={100}
            value={overrideInput}
            onChange={(e) => setOverrideInput(e.target.value)}
            placeholder="0-100"
            className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
          />
          <button
            onClick={handleOverride}
            disabled={!overrideInput}
            className="px-2 py-1 text-[10px] bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
          >
            Set
          </button>
        </div>
      )}

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between text-[10px] bg-zinc-800/30 border border-zinc-800 rounded px-2 py-1"
            >
              <span className="text-zinc-400">{entry.source}</span>
              <span className={`font-mono ${
                LEAD_SCORE_CONFIG[entry.label as LeadScoreLabel]?.textClass ?? 'text-zinc-400'
              }`}>
                {entry.score}
              </span>
              <span className="text-zinc-600">
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {showHistory && history.length === 0 && (
        <p className="text-[10px] text-zinc-600 mt-2">No score history yet</p>
      )}
    </div>
  );
}
