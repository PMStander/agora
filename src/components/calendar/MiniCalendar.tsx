import { useMemo } from 'react';

interface MiniCalendarProps {
  year: number;
  month: number;
  selectedDate: string;
  onDateSelect: (date: string) => void;
  eventDates?: Set<string>;
}

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MiniCalendar({ year, month, selectedDate, onDateSelect, eventDates }: MiniCalendarProps) {
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: dateToStr(d), day: d.getDate(), isCurrentMonth: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(year, month, d);
      days.push({ date: dateToStr(dt), day: d, isCurrentMonth: true });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: dateToStr(d), day: d.getDate(), isCurrentMonth: false });
      }
    }

    return days;
  }, [year, month]);

  const today = dateToStr(new Date());
  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="select-none">
      <div className="text-xs font-medium text-zinc-400 text-center mb-2">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-0">
        {DAY_NAMES.map((name, i) => (
          <div key={i} className="text-center text-[10px] text-zinc-600 pb-1">
            {name}
          </div>
        ))}
        {cells.map(({ date, day, isCurrentMonth }) => {
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const hasEvents = eventDates?.has(date);

          return (
            <button
              key={date}
              onClick={() => onDateSelect(date)}
              className={`w-7 h-7 text-[11px] rounded-full flex items-center justify-center relative transition-colors ${
                !isCurrentMonth
                  ? 'text-zinc-700'
                  : isSelected
                  ? 'bg-amber-500 text-zinc-900 font-medium'
                  : isToday
                  ? 'bg-amber-500/20 text-amber-400 font-medium'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {day}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
