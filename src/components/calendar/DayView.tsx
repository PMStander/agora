import { useMemo } from 'react';
import type { CalendarEvent } from '../../types/calendar';
import { EventCard } from './EventCard';

interface DayViewProps {
  selectedDate: string;
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getHour(iso: string): number {
  return new Date(iso).getHours();
}

export function DayView({ selectedDate, events, onEventClick }: DayViewProps) {
  const dayEvents = useMemo(() => {
    return events
      .filter((e) => e.start_at.slice(0, 10) === selectedDate)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [events, selectedDate]);

  const allDayEvents = dayEvents.filter((e) => e.all_day);
  const timedEvents = dayEvents.filter((e) => !e.all_day);

  const eventsByHour = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const e of timedEvents) {
      const h = getHour(e.start_at);
      if (!map[h]) map[h] = [];
      map[h].push(e);
    }
    return map;
  }, [timedEvents]);

  const dateParts = selectedDate.split('-');
  const dateLabel = new Date(
    parseInt(dateParts[0]),
    parseInt(dateParts[1]) - 1,
    parseInt(dateParts[2])
  ).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-300">{dateLabel}</h3>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">All Day</span>
          {allDayEvents.map((e) => (
            <EventCard key={e.id} event={e} compact onClick={() => onEventClick(e.id)} />
          ))}
        </div>
      )}

      {/* Hour grid */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const hourEvents = eventsByHour[hour] || [];
          const label = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour} ${hour < 12 ? 'AM' : 'PM'}`;

          return (
            <div
              key={hour}
              className="flex border-b border-zinc-800/30 min-h-[48px]"
            >
              <div className="w-16 shrink-0 text-right pr-2 py-1 text-[10px] text-zinc-600">
                {label}
              </div>
              <div className="flex-1 border-l border-zinc-800/30 p-1 space-y-0.5">
                {hourEvents.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    compact
                    onClick={() => onEventClick(e.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
