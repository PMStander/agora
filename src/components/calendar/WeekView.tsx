import { useMemo } from 'react';
import type { CalendarEvent } from '../../types/calendar';
import { EventCard } from './EventCard';

interface WeekViewProps {
  selectedDate: string;
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
  onDateSelect: (date: string) => void;
}

function getWeekDays(dateStr: string): Date[] {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekView({ selectedDate, events, onEventClick, onDateSelect }: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const today = dateToStr(new Date());

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const d = e.start_at.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(e);
    }
    // Sort events within each day
    for (const key in map) {
      map[key].sort((a, b) => a.start_at.localeCompare(b.start_at));
    }
    return map;
  }, [events]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-zinc-800">
        {weekDays.map((d, i) => {
          const ds = dateToStr(d);
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          return (
            <button
              key={ds}
              onClick={() => onDateSelect(ds)}
              className={`text-center py-2 transition-colors ${
                isSelected ? 'bg-amber-500/10' : 'hover:bg-zinc-800/50'
              }`}
            >
              <div className="text-[10px] text-zinc-500">{DAY_NAMES[i]}</div>
              <div
                className={`text-sm font-medium mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full ${
                  isToday ? 'bg-amber-500 text-zinc-900' : 'text-zinc-300'
                }`}
              >
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {weekDays.map((d) => {
          const ds = dateToStr(d);
          const dayEvents = eventsByDate[ds] || [];
          const isSelected = ds === selectedDate;

          return (
            <div
              key={ds}
              className={`border-r border-zinc-800/50 p-1 space-y-1 min-h-[200px] ${
                isSelected ? 'bg-amber-500/5' : ''
              }`}
            >
              {dayEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  compact
                  onClick={() => onEventClick(e.id)}
                />
              ))}
              {dayEvents.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[10px] text-zinc-700">--</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
