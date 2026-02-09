import { useAgentStore } from '../../stores/agents';
import { getSessionPreset, type BoardroomSession } from '../../types/boardroom';

interface SessionCardProps {
  session: BoardroomSession;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400 bg-blue-500/10',
  open: 'text-zinc-400 bg-zinc-700/50',
  active: 'text-green-400 bg-green-500/10',
  closed: 'text-zinc-500 bg-zinc-800',
};

export function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const preset = getSessionPreset(session.session_type);

  const participantEmojis = session.participant_agent_ids
    .slice(0, 5)
    .map((id) => agentProfiles[id]?.emoji || '?');

  const dateStr = session.started_at
    ? new Date(session.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg border transition-all
        ${isSelected
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-800/30'
        }
      `}
    >
      {/* Top row: type icon + title + status */}
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0">{preset.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate">{session.title}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[session.status] || STATUS_COLORS.open}`}>
              {session.status === 'active' ? '● LIVE' : session.status}
            </span>
            <span className="text-[10px] text-zinc-600">{dateStr}</span>
          </div>
        </div>
      </div>

      {/* Bottom row: participants + turn count */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center -space-x-1">
          {participantEmojis.map((emoji, i) => (
            <span key={i} className="text-xs">{emoji}</span>
          ))}
          {session.participant_agent_ids.length > 5 && (
            <span className="text-[10px] text-zinc-500 ml-1">+{session.participant_agent_ids.length - 5}</span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600">
          {session.turn_count}/{session.max_turns} turns
        </span>
      </div>
    </button>
  );
}
