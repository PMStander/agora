import { useMemo } from 'react';
import type { CalendarEvent } from '../../types/calendar';
import { EventCard } from './EventCard';

interface AgendaViewProps {
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
}

function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function AgendaView({ events, onEventClick }: AgendaViewProps) {
  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events
      .filter((e) => e.start_at >= now && e.status !== 'cancelled')
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [events]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; events: CalendarEvent[] }> = [];
    let currentDate = '';

    for (const e of upcomingEvents) {
      const d = e.start_at.slice(0, 10);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, events: [] });
      }
      groups[groups.length - 1].events.push(e);
    }
    return groups;
  }, [upcomingEvents]);

  if (upcomingEvents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <div className="text-3xl mb-2">--</div>
          <p className="text-sm">No upcoming events</p>
          <p className="text-xs mt-1">Create an event to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {groupedByDate.map(({ date, events: dayEvents }) => (
        <div key={date}>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            {formatDateHeader(date)}
          </div>
          <div className="space-y-2">
            {dayEvents.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                onClick={() => onEventClick(e.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
