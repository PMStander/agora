import type { CalendarEvent } from '../../types/calendar';
import { EVENT_TYPE_CONFIG } from '../../types/calendar';

interface EventCardProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  zinc: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export function EventCard({ event, compact, onClick }: EventCardProps) {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type];
  const colorClasses = COLOR_MAP[event.color || typeConfig.color] || COLOR_MAP.blue;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-2 py-1 rounded text-xs border truncate transition-colors hover:opacity-80 ${colorClasses}`}
      >
        {!event.all_day && (
          <span className="opacity-70 mr-1">{formatTime(event.start_at)}</span>
        )}
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors hover:opacity-80 ${colorClasses}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center bg-white/10">
          {typeConfig.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{event.title}</div>
          <div className="text-xs opacity-70 mt-0.5">
            {event.all_day
              ? 'All day'
              : `${formatTime(event.start_at)}${event.end_at ? ` - ${formatTime(event.end_at)}` : ''}`}
          </div>
          {event.location && (
            <div className="text-xs opacity-60 mt-0.5 truncate">{event.location}</div>
          )}
        </div>
      </div>
    </button>
  );
}
