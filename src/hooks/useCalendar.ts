import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useCalendarStore } from '../stores/calendar';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import type { CalendarEvent, CalendarEventType, CalendarEventStatus } from '../types/calendar';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCalendar() {
  const store = useCalendarStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch calendar events for a wide range (current month +/- 2 months)
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

    supabase
      .from('calendar_events')
      .select('*')
      .gte('start_at', rangeStart)
      .lte('start_at', rangeEnd)
      .order('start_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) store.setEvents(data as CalendarEvent[]);
      });

    // Realtime subscriptions
    const eventsSub = supabase
      .channel('calendar-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        (payload) =>
          handleRealtimePayload<CalendarEvent>(
            payload,
            store.addEvent,
            store.updateEvent,
            store.removeEvent
          )
      )
      .subscribe();

    return () => {
      eventsSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch events for a specific date range ──
  const fetchEventsForRange = useCallback(
    async (startDate: string, endDate: string) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_at', startDate)
        .lte('start_at', endDate)
        .order('start_at', { ascending: true });
      if (error) {
        console.error('[Calendar] Error fetching events:', error);
        return [];
      }
      // Merge into store
      const events = data as CalendarEvent[];
      events.forEach((e) => store.addEvent(e));
      return events;
    },
    [store]
  );

  // ── Create event ──
  const createEvent = useCallback(
    async (data: {
      title: string;
      description?: string;
      event_type?: CalendarEventType;
      status?: CalendarEventStatus;
      start_at: string;
      end_at?: string;
      all_day?: boolean;
      timezone?: string;
      recurrence_rule?: string;
      location?: string;
      meeting_url?: string;
      contact_id?: string;
      company_id?: string;
      deal_id?: string;
      project_id?: string;
      owner_agent_id?: string;
      attendee_agent_ids?: string[];
      reminder_minutes?: number[];
      color?: string;
    }) => {
      const { data: event, error } = await supabase
        .from('calendar_events')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[Calendar] Error creating event:', error);
        return null;
      }

      const created = event as CalendarEvent;
      store.addEvent(created);

      // Auto-create crm_interaction when event is linked to a contact
      if (data.contact_id && (data.event_type === 'meeting' || data.event_type === 'call')) {
        const interactionType = data.event_type === 'meeting' ? 'meeting' : 'call';
        const { data: interaction } = await supabase
          .from('crm_interactions')
          .insert({
            interaction_type: interactionType,
            subject: data.title,
            contact_id: data.contact_id,
            company_id: data.company_id || null,
            deal_id: data.deal_id || null,
            agent_id: data.owner_agent_id || null,
            direction: 'outbound',
            scheduled_at: data.start_at,
            metadata: { calendar_event_id: created.id },
          })
          .select()
          .single();

        // Link interaction back to event
        if (interaction) {
          await supabase
            .from('calendar_events')
            .update({ interaction_id: interaction.id })
            .eq('id', created.id);
          store.updateEvent(created.id, { interaction_id: interaction.id });
        }
      }

      return created;
    },
    [store]
  );

  // ── Update event ──
  const updateEventDetails = useCallback(
    async (eventId: string, updates: Partial<CalendarEvent>) => {
      const { error } = await supabase
        .from('calendar_events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', eventId);
      if (error) {
        console.error('[Calendar] Error updating event:', error);
        return;
      }
      store.updateEvent(eventId, updates);
    },
    [store]
  );

  // ── Delete event ──
  const deleteEvent = useCallback(
    async (eventId: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
      if (error) {
        console.error('[Calendar] Error deleting event:', error);
        return;
      }
      store.removeEvent(eventId);
    },
    [store]
  );

  // ── Create event from CRM interaction ──
  const createEventFromInteraction = useCallback(
    async (interaction: {
      id: string;
      interaction_type: string;
      subject: string | null;
      contact_id: string | null;
      company_id: string | null;
      deal_id: string | null;
      agent_id: string | null;
      scheduled_at: string | null;
    }) => {
      if (!interaction.scheduled_at) return null;

      const endAt = new Date(new Date(interaction.scheduled_at).getTime() + 60 * 60 * 1000).toISOString();
      const eventType = interaction.interaction_type === 'call' ? 'call' : 'meeting';

      return createEvent({
        title: interaction.subject || `${interaction.interaction_type} event`,
        event_type: eventType as CalendarEventType,
        start_at: interaction.scheduled_at,
        end_at: endAt,
        contact_id: interaction.contact_id || undefined,
        company_id: interaction.company_id || undefined,
        deal_id: interaction.deal_id || undefined,
        owner_agent_id: interaction.agent_id || undefined,
      });
    },
    [createEvent]
  );

  // ── Google Calendar sync placeholders ──
  // These will be implemented when Google OAuth infrastructure is set up.
  // For now they log a message indicating the feature is pending OAuth setup.

  const syncFromGoogle = useCallback(async () => {
    console.info('[Calendar] Google Calendar sync requires OAuth setup. See src/lib/googleCalendar.ts');
  }, []);

  const pushToGoogle = useCallback(async (_eventId: string) => {
    console.info('[Calendar] Push to Google Calendar requires OAuth setup. See src/lib/googleCalendar.ts');
  }, []);

  return {
    // Data
    events: store.events,

    // CRUD
    createEvent,
    updateEventDetails,
    deleteEvent,
    fetchEventsForRange,

    // CRM integration
    createEventFromInteraction,

    // Google sync
    syncFromGoogle,
    pushToGoogle,

    // State
    isConfigured: isSupabaseConfigured(),
  };
}
