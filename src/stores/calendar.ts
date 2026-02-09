import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CalendarEvent, CalendarViewMode } from '../types/calendar';

// ─── Store Interface ────────────────────────────────────────────────────────

interface CalendarState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  events: CalendarEvent[];

  // UI State (persisted)
  selectedEventId: string | null;
  selectedDate: string; // ISO date string (YYYY-MM-DD)
  viewMode: CalendarViewMode;
  showCreateModal: boolean;
  createModalPrefill: {
    contact_id?: string;
    company_id?: string;
    deal_id?: string;
    project_id?: string;
    start_at?: string;
  } | null;

  // ─── Event Actions ──────────────────────────────────────
  setEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (eventId: string, updates: Partial<CalendarEvent>) => void;
  removeEvent: (eventId: string) => void;

  // ─── UI Actions ─────────────────────────────────────────
  selectEvent: (id: string | null) => void;
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: CalendarViewMode) => void;
  setShowCreateModal: (show: boolean, prefill?: CalendarState['createModalPrefill']) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const CALENDAR_STORAGE_KEY = 'agora-calendar-v1';

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      // Initial data
      events: [],

      // UI State
      selectedEventId: null,
      selectedDate: new Date().toISOString().slice(0, 10),
      viewMode: 'month',
      showCreateModal: false,
      createModalPrefill: null,

      // Event Actions (upsert pattern)
      setEvents: (events) => set({ events }),
      addEvent: (event) =>
        set((state) => {
          const idx = state.events.findIndex((e) => e.id === event.id);
          if (idx === -1) return { events: [event, ...state.events] };
          const events = [...state.events];
          events[idx] = { ...events[idx], ...event };
          return { events };
        }),
      updateEvent: (eventId, updates) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === eventId ? { ...e, ...updates } : e
          ),
        })),
      removeEvent: (eventId) =>
        set((state) => ({
          events: state.events.filter((e) => e.id !== eventId),
          selectedEventId:
            state.selectedEventId === eventId ? null : state.selectedEventId,
        })),

      // UI Actions
      selectEvent: (id) => set({ selectedEventId: id }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setShowCreateModal: (show, prefill) =>
        set({ showCreateModal: show, createModalPrefill: prefill || null }),
    }),
    {
      name: CALENDAR_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state, NOT entity data
      partialize: (state) => ({
        selectedEventId: state.selectedEventId,
        selectedDate: state.selectedDate,
        viewMode: state.viewMode,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedEvent = () => {
  const events = useCalendarStore((s) => s.events);
  const selectedId = useCalendarStore((s) => s.selectedEventId);
  return events.find((e) => e.id === selectedId) || null;
};

export const useEventsForDate = (dateStr: string) => {
  const events = useCalendarStore((s) => s.events);
  return events.filter((e) => {
    const eventDate = e.start_at.slice(0, 10);
    return eventDate === dateStr && e.status !== 'cancelled';
  });
};

export const useEventsForMonth = (year: number, month: number) => {
  const events = useCalendarStore((s) => s.events);
  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, month + 1, 0);
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return events.filter((e) => {
    const d = e.start_at.slice(0, 10);
    return d >= startStr && d <= endStr && e.status !== 'cancelled';
  });
};

export const useUpcomingEvents = (limit = 10) => {
  const events = useCalendarStore((s) => s.events);
  const now = new Date().toISOString();
  return events
    .filter((e) => e.start_at >= now && e.status !== 'cancelled')
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, limit);
};

export const useEventsForContact = (contactId: string | null) => {
  const events = useCalendarStore((s) => s.events);
  if (!contactId) return [];
  return events
    .filter((e) => e.contact_id === contactId && e.status !== 'cancelled')
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
};

export const useEventsForDeal = (dealId: string | null) => {
  const events = useCalendarStore((s) => s.events);
  if (!dealId) return [];
  return events
    .filter((e) => e.deal_id === dealId && e.status !== 'cancelled')
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
};
