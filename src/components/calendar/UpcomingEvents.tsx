import { useUpcomingEvents } from '../../stores/calendar';
import { EVENT_TYPE_CONFIG } from '../../types/calendar';

interface UpcomingEventsProps {
  limit?: number;
  onEventClick?: (eventId: string) => void;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86400000);

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays < 7) {
    return `${d.toLocaleDateString('en-US', { weekday: 'short' })}, ${time}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${time}`;
}

const COLOR_MAP: Record<string, string> = {
  blue: 'border-l-blue-400',
  green: 'border-l-green-400',
  amber: 'border-l-amber-400',
  purple: 'border-l-purple-400',
  red: 'border-l-red-400',
  cyan: 'border-l-cyan-400',
  zinc: 'border-l-zinc-400',
};

export function UpcomingEvents({ limit = 5, onEventClick }: UpcomingEventsProps) {
  const events = useUpcomingEvents(limit);

  if (events.length === 0) {
    return (
      <div className="text-xs text-zinc-600 text-center py-3">
        No upcoming events
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {events.map((event) => {
        const typeConfig = EVENT_TYPE_CONFIG[event.event_type];
        const borderColor = COLOR_MAP[event.color || typeConfig.color] || COLOR_MAP.blue;

        return (
          <button
            key={event.id}
            onClick={() => onEventClick?.(event.id)}
            className={`w-full text-left bg-zinc-800/30 border border-zinc-800 border-l-2 ${borderColor} rounded p-2 hover:bg-zinc-800/50 transition-colors`}
          >
            <div className="text-xs text-zinc-300 truncate font-medium">
              {event.title}
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5">
              {event.all_day ? 'All day' : formatRelativeDate(event.start_at)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
