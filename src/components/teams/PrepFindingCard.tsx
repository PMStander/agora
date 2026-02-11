import { useAgentStore } from '../../stores/agents';
import type { PrepResult } from '../../types/boardroom';

interface PrepFindingCardProps {
  result: PrepResult;
  onNavigateToMission?: (missionId: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'text-zinc-500 bg-zinc-800' },
  running: { label: 'Working...', cls: 'text-amber-400 bg-amber-500/10 animate-pulse' },
  completed: { label: 'Done', cls: 'text-emerald-400 bg-emerald-500/10' },
  error: { label: 'Error', cls: 'text-red-400 bg-red-500/10' },
};

export function PrepFindingCard({ result, onNavigateToMission }: PrepFindingCardProps) {
  const agent = useAgentStore((s) => s.agentProfiles[result.agent_id]);
  const badge = STATUS_BADGE[result.status] || STATUS_BADGE.pending;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50">
        <span className="text-sm">{agent?.emoji || '?'}</span>
        <span className="text-xs font-medium text-zinc-300">{agent?.name || result.agent_id}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
        {result.mission_id && onNavigateToMission && (
          <button
            onClick={() => onNavigateToMission(result.mission_id!)}
            className="ml-auto text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
          >
            View Mission →
          </button>
        )}
      </div>

      {/* Content */}
      {result.text && (
        <div className="px-3 py-2 text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {result.text}
        </div>
      )}

      {result.error && (
        <div className="px-3 py-2 text-xs text-red-400">
          {result.error}
        </div>
      )}
    </div>
  );
}
