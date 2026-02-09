import { useMemo } from 'react';
import type { CalendarEvent } from '../../types/calendar';
import { EventCard } from './EventCard';

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onEventClick: (eventId: string) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MonthView({
  year,
  month,
  events,
  selectedDate,
  onDateSelect,
  onEventClick,
}: MonthViewProps) {
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month padding
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: dateToStr(d), day: d.getDate(), isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(year, month, d);
      days.push({ date: dateToStr(dt), day: d, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: dateToStr(d), day: d.getDate(), isCurrentMonth: false });
      }
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const d = e.start_at.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(e);
    }
    return map;
  }, [events]);

  const today = dateToStr(new Date());

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-medium text-zinc-500 py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {cells.map(({ date, day, isCurrentMonth }) => {
          const dayEvents = eventsByDate[date] || [];
          const isToday = date === today;
          const isSelected = date === selectedDate;

          return (
            <button
              key={date}
              onClick={() => onDateSelect(date)}
              className={`
                min-h-[80px] border-b border-r border-zinc-800/50 p-1 text-left
                transition-colors cursor-pointer
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${isSelected ? 'bg-amber-500/5' : 'hover:bg-zinc-800/30'}
              `}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-amber-500 text-zinc-900'
                      : isCurrentMonth
                      ? 'text-zinc-300'
                      : 'text-zinc-600'
                  }`}
                >
                  {day}
                </span>
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-zinc-500">
                    +{dayEvents.length - 2}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    compact
                    onClick={() => {
                      onEventClick(e.id);
                    }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
