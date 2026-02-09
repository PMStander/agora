import { useState, useMemo } from 'react';
import { useAgentLevel } from '../../hooks/useAgentLevel';
import { cn } from '../../lib/utils';
import { getAgent, type GuardrailViolationSeverity } from '../../types/supabase';

const SEVERITY_STYLES: Record<
  GuardrailViolationSeverity,
  { dot: string; text: string; bg: string }
> = {
  info: { dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/10' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10' },
  critical: { dot: 'bg-red-400', text: 'text-red-300', bg: 'bg-red-500/10' },
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface ViolationsFeedProps {
  agentId?: string;
  limit?: number;
}

export function ViolationsFeed({ agentId, limit = 20 }: ViolationsFeedProps) {
  const { violations } = useAgentLevel();
  const [severityFilter, setSeverityFilter] = useState<GuardrailViolationSeverity | 'all'>('all');

  const filtered = useMemo(() => {
    let result = violations;
    if (agentId) {
      result = result.filter((v) => v.agent_id === agentId);
    }
    if (severityFilter !== 'all') {
      result = result.filter((v) => v.severity === severityFilter);
    }
    return result.slice(0, limit);
  }, [violations, agentId, severityFilter, limit]);

  return (
    <div className="space-y-2">
      {/* Filter */}
      <div className="flex items-center gap-1.5 px-1">
        {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={cn(
              'px-2 py-0.5 text-[10px] rounded-full border transition-colors',
              severityFilter === s
                ? s === 'all'
                  ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                  : `${SEVERITY_STYLES[s].bg} ${SEVERITY_STYLES[s].text} border-current/20`
                : 'bg-transparent text-zinc-600 border-zinc-800 hover:text-zinc-400',
            )}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center text-zinc-600 py-4 text-xs">
          No violations{severityFilter !== 'all' ? ` (${severityFilter})` : ''}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((violation) => {
            const style = SEVERITY_STYLES[violation.severity];
            const agent = getAgent(violation.agent_id);
            return (
              <div
                key={violation.id}
                className="flex items-start gap-2 py-1.5 px-2 hover:bg-zinc-800/50 rounded transition-colors"
              >
                <span className={cn('w-2 h-2 rounded-full mt-1 shrink-0', style.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-300 truncate">
                    <span className={style.text}>{violation.action_attempted}</span>
                    <span className="text-zinc-600"> &mdash; </span>
                    {violation.guardrail_violated}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-0.5">
                    {agent && <span>{agent.name}</span>}
                    <span>{violation.resolution}</span>
                    <span>{formatTime(violation.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
