import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useBoardroomStore } from '../stores/boardroom';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import { createNotificationDirect } from './useNotifications';
import type { BoardroomSession, BoardroomMessage, BoardroomSessionType, BoardroomSessionMetadata, BoardroomSessionStatus } from '../types/boardroom';

export function useBoardroom() {
  // Subscribe only to `sessions` for the return value — NOT the entire store.
  // Callbacks access the store via getState() so they remain stable.
  const sessions = useBoardroomStore((s) => s.sessions);
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
        if (!error && data) useBoardroomStore.getState().setSessions(data as BoardroomSession[]);
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
            (s) => useBoardroomStore.getState().addSession(s),
            (id, updates) => useBoardroomStore.getState().updateSession(id, updates),
            (id) => useBoardroomStore.getState().removeSession(id)
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
            useBoardroomStore.getState().addMessage(payload.new as BoardroomMessage);
          }
        }
      )
      .subscribe();

    // Scheduled session polling (every 60s)
    const scheduledPollInterval = setInterval(() => {
      const currentSessions = useBoardroomStore.getState().sessions;
      const now = new Date();
      for (const session of currentSessions) {
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
      project_id?: string;
    }) => {
      const hasPrepWork = data.metadata?.preparation?.assignments?.length;
      const isChatMode = data.session_type === 'chat';
      const status = data.scheduled_at ? 'scheduled' : hasPrepWork ? 'preparing' : isChatMode ? 'active' : 'open';
      const insertData: Record<string, unknown> = {
        title: data.title,
        topic: data.topic,
        session_type: data.session_type,
        status,
        participant_agent_ids: data.participant_agent_ids,
        max_turns: data.max_turns,
        scheduled_at: data.scheduled_at,
        created_by: 'user',
        metadata: data.metadata || {},
      };
      if (data.project_id) insertData.project_id = data.project_id;
      if (isChatMode) insertData.started_at = new Date().toISOString();

      const { data: session, error } = await supabase
        .from('boardroom_sessions')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[Boardroom] Error creating session:', error);
        return null;
      }
      const created = session as BoardroomSession;
      const s = useBoardroomStore.getState();
      s.addSession(created);
      s.setSelectedSessionId(created.id);
      return created;
    },
    []
  );

  // ── Update session metadata ──
  const updateSessionMetadata = useCallback(
    async (sessionId: string, metadataUpdates: Partial<BoardroomSessionMetadata>) => {
      const session = useBoardroomStore.getState().sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const merged = { ...(session.metadata || {}), ...metadataUpdates };
      const { error } = await supabase
        .from('boardroom_sessions')
        .update({ metadata: merged, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      if (!error) {
        useBoardroomStore.getState().updateSession(sessionId, { metadata: merged as BoardroomSessionMetadata });
      }
    },
    []
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
      useBoardroomStore.getState().updateSession(sessionId, { status: 'active', started_at: now });
    },
    []
  );

  // ── Extend session (add more turns) ──
  const extendSession = useCallback(
    async (sessionId: string, additionalTurns: number) => {
      const session = useBoardroomStore.getState().sessions.find((s) => s.id === sessionId);
      if (!session) return;

      const newMaxTurns = session.max_turns + additionalTurns;
      const metadata = session.metadata as BoardroomSessionMetadata;
      const extensionCount = (metadata?.extension_count || 0) + 1;

      const { error } = await supabase
        .from('boardroom_sessions')
        .update({
          max_turns: newMaxTurns,
          metadata: { ...metadata, extension_count: extensionCount },
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (!error) {
        useBoardroomStore.getState().updateSession(sessionId, {
          max_turns: newMaxTurns,
          metadata: { ...metadata, extension_count: extensionCount } as BoardroomSessionMetadata,
        });
      }
    },
    []
  );

  // ── End session ──
  const endSession = useCallback(
    async (sessionId: string, metadata?: BoardroomSessionMetadata) => {
      const now = new Date().toISOString();
      const updates: any = { status: 'closed', ended_at: now, updated_at: now };
      if (metadata) {
        updates.metadata = metadata;
      }

      const { error } = await supabase
        .from('boardroom_sessions')
        .update(updates)
        .eq('id', sessionId);
      if (error) {
        console.error('[Boardroom] Error ending session:', error);
        return;
      }
      useBoardroomStore.getState().updateSession(sessionId, { status: 'closed', ended_at: now, ...(metadata ? { metadata } : {}) });
    },
    []
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
      useBoardroomStore.getState().setMessagesForSession(sessionId, messages);
      return messages;
    },
    []
  );

  // ── Find or create a project chat session ──
  const findOrCreateProjectChat = useCallback(
    async (projectId: string, participantAgentIds: string[], projectName?: string) => {
      // Check for an existing open/active chat session for this project
      const { data: existing } = await supabase
        .from('boardroom_sessions')
        .select('*')
        .eq('project_id', projectId)
        .eq('session_type', 'chat')
        .in('status', ['open', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const session = existing[0] as BoardroomSession;
        const s = useBoardroomStore.getState();
        s.addSession(session);
        s.setSelectedSessionId(session.id);
        return session;
      }

      // Create a new chat session for the project
      return createSession({
        title: `${projectName || 'Project'} Chat`,
        topic: '',
        session_type: 'chat',
        participant_agent_ids: participantAgentIds,
        max_turns: 999,
        scheduled_at: null,
        metadata: {},
        project_id: projectId,
      });
    },
    [createSession]
  );

  // ── Add message to session (persist to Supabase) ──
  const addMessageToSession = useCallback(
    async (data: {
      session_id: string;
      agent_id: string;
      content: string;
      reasoning?: string;
      turn_number: number;
      sender_type?: string;
      mentions?: any[];
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
      const s = useBoardroomStore.getState();
      s.addMessage(created);

      // Update turn count on session
      await supabase
        .from('boardroom_sessions')
        .update({ turn_count: data.turn_number, current_turn_agent_id: data.agent_id, updated_at: new Date().toISOString() })
        .eq('id', data.session_id);
      useBoardroomStore.getState().updateSession(data.session_id, { turn_count: data.turn_number, current_turn_agent_id: data.agent_id });

      return created;
    },
    []
  );

  // ── Update session (generic) ──
  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<BoardroomSession>) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('boardroom_sessions')
        .update({ ...updates, updated_at: now })
        .eq('id', sessionId);
      if (error) {
        console.error('[Boardroom] Error updating session:', error);
        return;
      }
      useBoardroomStore.getState().updateSession(sessionId, updates);
    },
    []
  );

  // ── Reschedule session ──
  const rescheduleSession = useCallback(
    async (sessionId: string, newScheduledAt: string | null): Promise<{ success: boolean; error?: string }> => {
      const session = useBoardroomStore.getState().sessions.find((s) => s.id === sessionId);
      if (!session) return { success: false, error: 'Session not found' };
      if (session.status === 'active') return { success: false, error: 'Cannot reschedule an active session' };

      const now = new Date();
      const metadata = (session.metadata || {}) as BoardroomSessionMetadata;
      const hasPrep = !!(metadata.preparation?.assignments?.length);
      const isChatMode = session.session_type === 'chat';

      let newStatus: BoardroomSessionStatus;
      if (newScheduledAt && new Date(newScheduledAt) > now) {
        newStatus = 'scheduled';
      } else {
        newStatus = hasPrep ? 'preparing' : isChatMode ? 'active' : 'open';
      }

      const updates: Partial<BoardroomSession> = {
        scheduled_at: newScheduledAt,
        status: newStatus,
      };

      const { error } = await supabase
        .from('boardroom_sessions')
        .update({ ...updates, updated_at: now.toISOString() })
        .eq('id', sessionId);

      if (error) {
        console.error('[Boardroom] Error rescheduling session:', error);
        return { success: false, error: error.message };
      }

      useBoardroomStore.getState().updateSession(sessionId, updates);

      const label = newScheduledAt
        ? `rescheduled to ${new Date(newScheduledAt).toLocaleString()}`
        : 'schedule removed (starts immediately)';
      createNotificationDirect('system', `Session ${label}`, session.title).catch(() => {});

      return { success: true };
    },
    []
  );

  // ── Delete session ──
  const deleteSession = useCallback(
    async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
      const session = useBoardroomStore.getState().sessions.find((s) => s.id === sessionId);
      if (!session) return { success: false, error: 'Session not found' };
      if (session.status === 'active') return { success: false, error: 'Cannot delete an active session' };

      const { error } = await supabase
        .from('boardroom_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('[Boardroom] Error deleting session:', error);
        return { success: false, error: error.message };
      }

      // Remove session from store (does NOT clean up messages)
      useBoardroomStore.getState().removeSession(sessionId);
      // Clean up messages in store
      useBoardroomStore.getState().setMessagesForSession(sessionId, []);

      createNotificationDirect('system', 'Session deleted', `"${session.title}" has been deleted`).catch(() => {});

      return { success: true };
    },
    []
  );

  // ── Restart session (clear messages, reset to initial state) ──
  const restartSession = useCallback(
    async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
      const session = useBoardroomStore.getState().sessions.find((s) => s.id === sessionId);
      if (!session) return { success: false, error: 'Session not found' };
      if (session.status === 'active') return { success: false, error: 'Cannot restart an active session' };

      // Delete all messages for this session
      const { error: msgError } = await supabase
        .from('boardroom_messages')
        .delete()
        .eq('session_id', sessionId);

      if (msgError) {
        console.error('[Boardroom] Error deleting session messages:', msgError);
        return { success: false, error: msgError.message };
      }

      const metadata = (session.metadata || {}) as BoardroomSessionMetadata;
      const hasPrep = !!(metadata.preparation?.assignments?.length);
      const isChatMode = session.session_type === 'chat';

      // Determine reset status
      const resetStatus: BoardroomSessionStatus = hasPrep ? 'preparing' : isChatMode ? 'active' : 'open';

      // Build clean metadata: keep config fields, strip conversation-specific fields
      const cleanMetadata: BoardroomSessionMetadata = {
        entity_references: metadata.entity_references,
        attachments: metadata.attachments,
        agenda: metadata.agenda,
        context: metadata.context,
        routing_mode: metadata.routing_mode,
        auto_start: metadata.auto_start,
        notify_whatsapp: metadata.notify_whatsapp,
        resolution_mode: metadata.resolution_mode,
        user_participation: metadata.user_participation,
      };

      // Reset preparation if it has assignments
      if (hasPrep) {
        cleanMetadata.preparation = {
          assignments: metadata.preparation!.assignments,
          results: [],
          status: 'pending',
        };
      }

      const now = new Date().toISOString();
      const updates: Partial<BoardroomSession> = {
        status: resetStatus,
        turn_count: 0,
        current_turn_agent_id: null,
        started_at: isChatMode ? now : null,
        ended_at: null,
        metadata: cleanMetadata,
      };

      const { error } = await supabase
        .from('boardroom_sessions')
        .update({ ...updates, updated_at: now })
        .eq('id', sessionId);

      if (error) {
        console.error('[Boardroom] Error restarting session:', error);
        return { success: false, error: error.message };
      }

      // Update local store
      useBoardroomStore.getState().updateSession(sessionId, updates);
      // Clear local messages
      useBoardroomStore.getState().setMessagesForSession(sessionId, []);

      createNotificationDirect('system', 'Session restarted', `"${session.title}" has been reset`).catch(() => {});

      return { success: true };
    },
    []
  );

  // ── Clone session ──
  const cloneSession = useCallback(
    async (sessionId: string): Promise<{ success: boolean; error?: string; session?: BoardroomSession }> => {
      const source = useBoardroomStore.getState().sessions.find((s) => s.id === sessionId);
      if (!source) return { success: false, error: 'Session not found' };

      const srcMeta = (source.metadata || {}) as BoardroomSessionMetadata;
      const isChatMode = source.session_type === 'chat';
      const hasPrep = !!(srcMeta.preparation?.assignments?.length);

      // Clone metadata, strip conversation-specific fields
      const clonedMetadata: BoardroomSessionMetadata = {
        entity_references: srcMeta.entity_references,
        attachments: srcMeta.attachments,
        agenda: srcMeta.agenda,
        context: srcMeta.context,
        routing_mode: srcMeta.routing_mode,
        auto_start: srcMeta.auto_start,
        notify_whatsapp: srcMeta.notify_whatsapp,
        resolution_mode: srcMeta.resolution_mode,
        user_participation: srcMeta.user_participation,
        cloned_from_session_id: sessionId,
      };

      // Preserve prep assignments but reset results
      if (hasPrep) {
        clonedMetadata.preparation = {
          assignments: srcMeta.preparation!.assignments,
          results: [],
          status: 'pending',
        };
      }

      const status = hasPrep ? 'preparing' : isChatMode ? 'active' : 'open';
      const insertData: Record<string, unknown> = {
        title: source.title,
        topic: source.topic,
        session_type: source.session_type,
        status,
        participant_agent_ids: source.participant_agent_ids,
        max_turns: source.max_turns,
        scheduled_at: null,
        created_by: 'user',
        metadata: clonedMetadata,
      };
      if (isChatMode && source.project_id) insertData.project_id = source.project_id;
      if (isChatMode) insertData.started_at = new Date().toISOString();

      const { data: newSession, error } = await supabase
        .from('boardroom_sessions')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[Boardroom] Error cloning session:', error);
        return { success: false, error: error.message };
      }

      const created = newSession as BoardroomSession;
      const s = useBoardroomStore.getState();
      s.addSession(created);
      s.setSelectedSessionId(created.id);

      createNotificationDirect('system', 'Session cloned', `"${source.title}" cloned with fresh conversation`).catch(() => {});

      return { success: true, session: created };
    },
    []
  );

  return {
    sessions,
    createSession,
    updateSession,
    startSession,
    endSession,
    extendSession,
    fetchMessages,
    addMessageToSession,
    updateSessionMetadata,
    findOrCreateProjectChat,
    rescheduleSession,
    cloneSession,
    deleteSession,
    restartSession,
    isConfigured: isSupabaseConfigured(),
  };
}
