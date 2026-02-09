import type { HandoffRequest } from '../../types/context';

interface HandoffCardProps {
  handoff: HandoffRequest;
  onAccept?: (id: string) => void;
  onComplete?: (id: string) => void;
  onDecline?: (id: string) => void;
}

const statusColors: Record<string, string> = {
  requested: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  declined: 'bg-red-500/20 text-red-400 border-red-500/30',
  timed_out: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const priorityColors: Record<string, string> = {
  low: 'text-zinc-500',
  medium: 'text-zinc-400',
  high: 'text-amber-400',
  urgent: 'text-red-400',
};

export function HandoffCard({
  handoff,
  onAccept,
  onComplete,
  onDecline,
}: HandoffCardProps) {
  const isActive = handoff.status === 'requested' || handoff.status === 'accepted';

  return (
    <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-800/50 space-y-2">
      {/* Status + Priority */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs px-1.5 py-0.5 rounded border ${
            statusColors[handoff.status] || ''
          }`}
        >
          {handoff.status}
        </span>
        <span
          className={`text-xs font-medium ${
            priorityColors[handoff.priority] || ''
          }`}
        >
          {handoff.priority}
        </span>
      </div>

      {/* Agents */}
      <div className="text-xs text-zinc-400">
        <span className="text-zinc-300">{handoff.requesting_agent_id}</span>
        {' -> '}
        <span className="text-zinc-300">{handoff.target_agent_id}</span>
      </div>

      {/* Reason */}
      <p className="text-sm text-zinc-300">{handoff.reason}</p>

      {/* Context summary */}
      {handoff.context_summary && (
        <p className="text-xs text-zinc-500 line-clamp-2">
          {handoff.context_summary}
        </p>
      )}

      {/* Outcome */}
      {handoff.outcome && (
        <div className="p-2 rounded bg-zinc-900/80 text-xs text-zinc-400">
          {handoff.outcome}
        </div>
      )}

      {/* Time */}
      <div className="text-xs text-zinc-600">
        {new Date(handoff.created_at).toLocaleString()}
        {handoff.time_taken_minutes != null && (
          <span className="ml-2">
            ({handoff.time_taken_minutes}m)
          </span>
        )}
      </div>

      {/* Actions */}
      {isActive && (
        <div className="flex gap-2 pt-1">
          {handoff.status === 'requested' && onAccept && (
            <button
              onClick={() => onAccept(handoff.id)}
              className="flex-1 px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              Accept
            </button>
          )}
          {(handoff.status === 'accepted' || handoff.status === 'in_progress') &&
            onComplete && (
              <button
                onClick={() => onComplete(handoff.id)}
                className="flex-1 px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
              >
                Complete
              </button>
            )}
          {isActive && onDecline && (
            <button
              onClick={() => onDecline(handoff.id)}
              className="px-2 py-1 text-xs rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Decline
            </button>
          )}
        </div>
      )}
    </div>
  );
}
