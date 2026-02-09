import { useState, useMemo } from 'react';
import { useCalendarStore, useEventsForMonth } from '../../stores/calendar';
import { useCalendar } from '../../hooks/useCalendar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { AgendaView } from './AgendaView';
import { ViewToggle } from './ViewToggle';
import { MiniCalendar } from './MiniCalendar';
import { CreateEventModal } from './CreateEventModal';

export function CalendarTab() {
  const {
    events,
    selectedDate,
    viewMode,
    showCreateModal,
    setSelectedDate,
    setViewMode,
    selectEvent,
    setShowCreateModal,
  } = useCalendarStore();
  useCalendar(); // init fetch + realtime

  const dateParts = selectedDate.split('-').map(Number);
  const year = dateParts[0];
  const month = dateParts[1] - 1; // 0-indexed

  const monthEvents = useEventsForMonth(year, month);

  const [sidebarMonth, setSidebarMonth] = useState({ year, month });

  const navigateMonth = (dir: number) => {
    const newDate = new Date(year, month + dir, 1);
    const newStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`;
    setSelectedDate(newStr);
    setSidebarMonth({ year: newDate.getFullYear(), month: newDate.getMonth() });
  };

  const goToToday = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setSelectedDate(todayStr);
    setSidebarMonth({ year: now.getFullYear(), month: now.getMonth() });
  };

  const eventDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.status !== 'cancelled') set.add(e.start_at.slice(0, 10));
    }
    return set;
  }, [events]);

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r border-zinc-800 p-4 space-y-4 overflow-y-auto shrink-0">
        {/* Create button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full px-4 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors font-medium"
        >
          + New Event
        </button>

        {/* Mini calendar */}
        <MiniCalendar
          year={sidebarMonth.year}
          month={sidebarMonth.month}
          selectedDate={selectedDate}
          onDateSelect={(d) => {
            setSelectedDate(d);
            const [y, m] = d.split('-').map(Number);
            setSidebarMonth({ year: y, month: m - 1 });
          }}
          eventDates={eventDates}
        />

        {/* Mini calendar navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setSidebarMonth((s) => {
              const d = new Date(s.year, s.month - 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Prev
          </button>
          <button
            onClick={() => setSidebarMonth((s) => {
              const d = new Date(s.year, s.month + 1, 1);
              return { year: d.getFullYear(), month: d.getMonth() };
            })}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Next
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateMonth(-1)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            >
              &lt;
            </button>
            <h2 className="text-sm font-semibold text-zinc-200 min-w-[140px] text-center">
              {monthLabel}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            >
              &gt;
            </button>
            <button
              onClick={goToToday}
              className="text-xs text-amber-400 hover:text-amber-300 ml-2 px-2 py-1 rounded bg-amber-500/10 transition-colors"
            >
              Today
            </button>
          </div>
          <ViewToggle viewMode={viewMode} onViewChange={setViewMode} />
        </div>

        {/* View content */}
        {viewMode === 'month' && (
          <MonthView
            year={year}
            month={month}
            events={monthEvents}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onEventClick={selectEvent}
          />
        )}
        {viewMode === 'week' && (
          <WeekView
            selectedDate={selectedDate}
            events={events}
            onEventClick={selectEvent}
            onDateSelect={setSelectedDate}
          />
        )}
        {viewMode === 'day' && (
          <DayView
            selectedDate={selectedDate}
            events={events}
            onEventClick={selectEvent}
          />
        )}
        {viewMode === 'agenda' && (
          <AgendaView
            events={events}
            onEventClick={selectEvent}
          />
        )}
      </div>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
