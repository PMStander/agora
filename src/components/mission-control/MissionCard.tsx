import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMissionControlStore } from '../../stores/missionControl';
import { getAgent, type Mission } from '../../types/supabase';
import { assessMissionProof } from '../../lib/missionProof';

interface MissionCardProps {
  mission: Mission;
}

const priorityDot: Record<string, string> = {
  low: 'bg-zinc-400',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500 animate-pulse',
};

const priorityLabel: Record<string, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
  urgent: '🔥',
};

function formatScheduledTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const mins = Math.floor(absDiffMs / 60000);
  const hours = Math.floor(absDiffMs / 3600000);
  const days = Math.floor(absDiffMs / 86400000);

  if (diffMs > 0) {
    // Future
    if (mins < 60) return `in ${mins}m`;
    if (hours < 24) return `in ${hours}h`;
    return `in ${days}d`;
  } else {
    // Past
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

export function MissionCard({ mission }: MissionCardProps) {
  const selectMission = useMissionControlStore((s) => s.selectMission);
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const agent = getAgent(mission.agent_id);
  const proof = assessMissionProof(mission);
  const showProofBadge = mission.status === 'done' || mission.status === 'failed';
  const dragDisabled = (mission.mission_phase || 'tasks') !== 'tasks'
    || (mission.mission_phase_status || 'approved') !== 'approved';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mission.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        selectTask(null);
        selectMission(mission.id);
      }}
      className={`
        bg-zinc-800 border border-zinc-700 rounded-lg p-3 cursor-pointer
        hover:border-amber-500/50 hover:bg-zinc-800/80 transition-all
        ${dragDisabled ? 'cursor-default' : ''}
        ${isDragging ? 'shadow-lg shadow-amber-500/20' : ''}
      `}
    >
      {/* Top row: priority + scheduled time */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[mission.priority]}`} />
        <span className="text-xs text-zinc-500">{priorityLabel[mission.priority]}</span>
        <span className="text-xs text-zinc-600 ml-auto">
          {formatScheduledTime(mission.scheduled_at)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-zinc-100 line-clamp-2 mb-2">
        {mission.title}
      </h3>

      {/* Footer: agent + badges */}
      <div className="flex items-center justify-between">
        {/* Agent */}
        {agent && (
          <div className="flex items-center gap-1.5" title={`${agent.name} — ${agent.role}`}>
            <span className="text-sm">{agent.emoji}</span>
            <span className="text-xs text-zinc-400 truncate max-w-[100px]">
              {agent.name}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded"
            title={`Lifecycle phase: ${mission.mission_phase || 'tasks'}`}
          >
            {mission.mission_phase || 'tasks'}
          </span>
          {mission.status === 'in_progress' && (
            <span className="text-xs px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded">Running</span>
          )}
          {(mission.status === 'scheduled' || mission.status === 'assigned') && (
            <span className="text-xs px-1.5 py-0.5 bg-zinc-700 text-zinc-300 rounded">Waiting</span>
          )}
          {mission.review_enabled && (
            <span
              className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded"
              title="AI Review enabled"
            >
              👁️
            </span>
          )}
          {mission.revision_round > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded"
              title={`Revision ${mission.revision_round}/${mission.max_revisions}`}
            >
              R{mission.revision_round}
            </span>
          )}
          {showProofBadge && (
            <span
              className={`
                text-xs px-1.5 py-0.5 rounded
                ${proof.state === 'verified'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : proof.state === 'not_required'
                  ? 'bg-zinc-700 text-zinc-300'
                  : 'bg-rose-500/20 text-rose-300'
                }
              `}
              title={proof.detail}
            >
              {proof.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
