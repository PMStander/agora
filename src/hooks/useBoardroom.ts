import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useBoardroomStore } from '../stores/boardroom';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import { createNotificationDirect } from './useNotifications';
import type { BoardroomSession, BoardroomMessage, BoardroomSessionType, BoardroomSessionMetadata } from '../types/boardroom';

export function useBoardroom() {
  const store = useBoardroomStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch recent sessions
    supabase
      .from('boardroom_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) store.setSessions(data as BoardroomSession[]);
      });

    // Realtime: sessions
    const sessionsSub = supabase
      .channel('boardroom-sessions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boardroom_sessions' },
        (payload) =>
          handleRealtimePayload<BoardroomSession>(
            payload,
            store.addSession,
            (id, updates) => store.updateSession(id, updates),
            store.removeSession
          )
      )
      .subscribe();

    // Realtime: messages
    const messagesSub = supabase
      .channel('boardroom-messages-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boardroom_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            store.addMessage(payload.new as BoardroomMessage);
          }
        }
      )
      .subscribe();

    // Scheduled session polling (every 60s)
    const scheduledPollInterval = setInterval(() => {
      const sessions = useBoardroomStore.getState().sessions;
      const now = new Date();
      for (const session of sessions) {
        if (
          session.status === 'scheduled' &&
          session.scheduled_at &&
          new Date(session.scheduled_at) <= now
        ) {
          // Notify that a scheduled session is ready
          createNotificationDirect(
            'system',
            `Boardroom session ready: ${session.title}`,
            'A scheduled session is ready to start.',
          ).catch(() => {});

          // Transition from 'scheduled' to 'open'
          supabase
            .from('boardroom_sessions')
            .update({ status: 'open', updated_at: now.toISOString() })
            .eq('id', session.id)
            .then(({ error }) => {
              if (!error) {
                useBoardroomStore.getState().updateSession(session.id, { status: 'open' });
              }
            });
        }
      }
    }, 60_000);

    return () => {
      sessionsSub.unsubscribe();
      messagesSub.unsubscribe();
      clearInterval(scheduledPollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Create session ──
  const createSession = useCallback(
    async (data: {
      title: string;
      topic: string;
      session_type: BoardroomSessionType;
      participant_agent_ids: string[];
      max_turns: number;
      scheduled_at: string | null;
      metadata?: BoardroomSessionMetadata;
    }) => {
      const hasPrepWork = data.metadata?.preparation?.assignments?.length;
      const status = data.scheduled_at ? 'scheduled' : hasPrepWork ? 'preparing' : 'open';
      const { data: session, error } = await supabase
        .from('boardroom_sessions')
        .insert({
          title: data.title,
          topic: data.topic,
          session_type: data.session_type,
          status,
          participant_agent_ids: data.participant_agent_ids,
          max_turns: data.max_turns,
          scheduled_at: data.scheduled_at,
          created_by: 'user',
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[Boardroom] Error creating session:', error);
        return null;
      }
      const created = session as BoardroomSession;
      store.addSession(created);
      store.setSelectedSessionId(created.id);
      return created;
    },
    [store]
  );

  // ── Update session metadata ──
  const updateSessionMetadata = useCallback(
    async (sessionId: string, metadataUpdates: Partial<BoardroomSessionMetadata>) => {
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const merged = { ...(session.metadata || {}), ...metadataUpdates };
      const { error } = await supabase
        .from('boardroom_sessions')
        .update({ metadata: merged, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (!error) {
        store.updateSession(sessionId, { metadata: merged as BoardroomSessionMetadata });
      }
    },
    [store]
  );

  // ── Start session (transition to active) ──
  const startSession = useCallback(
    async (sessionId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('boardroom_sessions')
        .update({ status: 'active', started_at: now, updated_at: now })
        .eq('id', sessionId);
      if (error) {
        console.error('[Boardroom] Error starting session:', error);
        return;
      }
      store.updateSession(sessionId, { status: 'active', started_at: now });
    },
    [store]
  );

  // ── End session ──
  const endSession = useCallback(
    async (sessionId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('boardroom_sessions')
        .update({ status: 'closed', ended_at: now, updated_at: now })
        .eq('id', sessionId);
      if (error) {
        console.error('[Boardroom] Error ending session:', error);
        return;
      }
      store.updateSession(sessionId, { status: 'closed', ended_at: now });
    },
    [store]
  );

  // ── Fetch messages for a session ──
  const fetchMessages = useCallback(
    async (sessionId: string) => {
      const { data, error } = await supabase
        .from('boardroom_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('turn_number', { ascending: true });
      if (error) {
        console.error('[Boardroom] Error fetching messages:', error);
        return [];
      }
      const messages = data as BoardroomMessage[];
      store.setMessagesForSession(sessionId, messages);
      return messages;
    },
    [store]
  );

  // ── Add message to session (persist to Supabase) ──
  const addMessageToSession = useCallback(
    async (data: {
      session_id: string;
      agent_id: string;
      content: string;
      reasoning?: string;
      turn_number: number;
    }) => {
      const { data: msg, error } = await supabase
        .from('boardroom_messages')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[Boardroom] Error adding message:', error);
        return null;
      }
      const created = msg as BoardroomMessage;
      store.addMessage(created);

      // Update turn count on session
      await supabase
        .from('boardroom_sessions')
        .update({ turn_count: data.turn_number, current_turn_agent_id: data.agent_id, updated_at: new Date().toISOString() })
        .eq('id', data.session_id);
      store.updateSession(data.session_id, { turn_count: data.turn_number, current_turn_agent_id: data.agent_id });

      return created;
    },
    [store]
  );

  return {
    sessions: store.sessions,
    createSession,
    startSession,
    endSession,
    fetchMessages,
    addMessageToSession,
    updateSessionMetadata,
    isConfigured: isSupabaseConfigured(),
  };
}
