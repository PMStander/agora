import type { CalendarViewMode } from '../../types/calendar';

interface ViewToggleProps {
  viewMode: CalendarViewMode;
  onViewChange: (mode: CalendarViewMode) => void;
}

const VIEWS: { mode: CalendarViewMode; label: string }[] = [
  { mode: 'month', label: 'Month' },
  { mode: 'week', label: 'Week' },
  { mode: 'day', label: 'Day' },
  { mode: 'agenda', label: 'Agenda' },
];

export function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
      {VIEWS.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => onViewChange(mode)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === mode
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
