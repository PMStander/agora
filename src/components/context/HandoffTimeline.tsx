import type { HandoffRequest } from '../../types/context';

interface HandoffTimelineProps {
  handoffs: HandoffRequest[];
}

const statusDotColors: Record<string, string> = {
  requested: 'bg-blue-500',
  accepted: 'bg-yellow-500',
  in_progress: 'bg-amber-500',
  completed: 'bg-green-500',
  declined: 'bg-red-500',
  timed_out: 'bg-zinc-500',
};

export function HandoffTimeline({ handoffs }: HandoffTimelineProps) {
  if (handoffs.length === 0) {
    return (
      <div className="text-center text-zinc-500 text-xs py-4">
        No handoff history
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {handoffs.map((handoff, idx) => (
        <div key={handoff.id} className="flex gap-3">
          {/* Timeline line + dot */}
          <div className="flex flex-col items-center">
            <span
              className={`w-2 h-2 rounded-full mt-1.5 ${
                statusDotColors[handoff.status] || 'bg-zinc-500'
              }`}
            />
            {idx < handoffs.length - 1 && (
              <div className="w-px flex-1 bg-zinc-700 my-1" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-300">
                {handoff.status}
              </span>
              <span className="text-xs text-zinc-600">
                {new Date(handoff.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{handoff.reason}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {handoff.requesting_agent_id} -{'>'} {handoff.target_agent_id}
            </p>
            {handoff.outcome && (
              <p className="text-xs text-zinc-500 mt-1 italic">{handoff.outcome}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
