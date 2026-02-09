import { useAgentLevel } from '../../hooks/useAgentLevel';
import { LevelBadge } from './LevelBadge';
import { getAgent } from '../../types/supabase';

export function PermissionOverridePanel() {
  const { pendingTransitions, approveTransition, rejectTransition } = useAgentLevel();

  const pending = pendingTransitions.filter((t) => t.status === 'pending');

  if (pending.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-zinc-800 bg-amber-500/5">
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
          Pending Approvals ({pending.length})
        </span>
      </div>
      <div className="px-4 pb-3 space-y-2">
        {pending.map((transition) => {
          const agent = getAgent(transition.agent_id);
          const agentName = agent?.name || transition.agent_id;
          return (
            <div
              key={transition.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-300 font-medium truncate">
                    {agentName}
                  </span>
                  <LevelBadge level={transition.from_level} />
                  <span className="text-zinc-600">&rarr;</span>
                  <LevelBadge level={transition.to_level} />
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 truncate">
                  {transition.reason}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => approveTransition(transition.id)}
                  className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectTransition(transition.id)}
                  className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
