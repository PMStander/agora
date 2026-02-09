import { cn } from '../../lib/utils';
import { AGENT_LEVEL_LABELS, type AgentLevel, type LevelHistoryEntry } from '../../types/supabase';

const LEVEL_DOT_COLORS: Record<AgentLevel, string> = {
  1: 'bg-zinc-500',
  2: 'bg-blue-500',
  3: 'bg-amber-500',
  4: 'bg-emerald-500',
};

const TRIGGER_LABELS: Record<string, string> = {
  promotion: 'Promoted',
  demotion: 'Demoted',
  manual_override: 'Manual Override',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface LevelTimelineProps {
  entries: LevelHistoryEntry[];
}

export function LevelTimeline({ entries }: LevelTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="text-xs text-zinc-600 py-2">No level transitions yet.</div>
    );
  }

  return (
    <div className="relative space-y-0">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        return (
          <div key={entry.id} className="flex gap-3 pb-4">
            {/* Vertical line + dot */}
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  'w-3 h-3 rounded-full shrink-0 z-10',
                  LEVEL_DOT_COLORS[entry.to_level],
                )}
              />
              {!isLast && (
                <div className="w-px flex-1 bg-zinc-700 absolute top-3 bottom-0" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 -mt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-200">
                  L{entry.from_level} &rarr; L{entry.to_level}{' '}
                  <span className="text-zinc-500">
                    ({AGENT_LEVEL_LABELS[entry.to_level]})
                  </span>
                </span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    entry.trigger === 'promotion'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : entry.trigger === 'demotion'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-zinc-700 text-zinc-400',
                  )}
                >
                  {TRIGGER_LABELS[entry.trigger] || entry.trigger}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{entry.reason}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                {formatDate(entry.created_at)} &middot; Approved by {entry.approved_by}
              </div>
              {entry.metrics_snapshot && (
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  Tasks: {entry.metrics_snapshot.tasks_completed} | Score:{' '}
                  {entry.metrics_snapshot.avg_review_score.toFixed(2)} | Violations:{' '}
                  {entry.metrics_snapshot.violations_30d}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
