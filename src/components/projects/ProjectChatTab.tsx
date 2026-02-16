// ─── Project Chat Tab ────────────────────────────────────────────────────────
// Wrapper that auto-creates or loads a chat session for the project,
// then renders the BoardroomChatView with session management.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardroom } from '../../hooks/useBoardroom';
import { useBoardroomStore } from '../../stores/boardroom';
import { BoardroomChatView } from '../teams/BoardroomChatView';
import type { Project } from '../../stores/projects';
import type { BoardroomSession } from '../../types/boardroom';
import { isSupabaseConfigured } from '../../lib/supabase';

interface ProjectChatTabProps {
  project: Project;
  projectAgentIds: string[];
}

export function ProjectChatTab({ project, projectAgentIds }: ProjectChatTabProps) {
  const { findOrCreateProjectChat, endSession, createSession, fetchMessages } = useBoardroom();
  const [session, setSession] = useState<BoardroomSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Load or create initial chat session
  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const chatSession = await findOrCreateProjectChat(
        project.id,
        projectAgentIds,
        project.name
      );

      if (chatSession) {
        setSession(chatSession);
        await fetchMessages(chatSession.id);
      } else {
        setError('Could not create chat session');
      }
    } catch (err) {
      console.error('[ProjectChatTab] Init error:', err);
      setError('Failed to initialize chat');
    } finally {
      setIsLoading(false);
    }
  }, [project.id, projectAgentIds, project.name, findOrCreateProjectChat, fetchMessages]);

  useEffect(() => {
    if (initializedRef.current || !isSupabaseConfigured()) return;
    initializedRef.current = true;
    loadSession();
  }, [loadSession]);

  // Start a new chat session (end current, create fresh)
  const handleNewChat = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);

    try {
      // End the current session
      await endSession(session.id);

      // Create a fresh session
      const newSession = await createSession({
        title: `${project.name} Chat`,
        topic: '',
        session_type: 'chat',
        participant_agent_ids: projectAgentIds,
        max_turns: 999,
        scheduled_at: null,
        metadata: {},
        project_id: project.id,
      });

      if (newSession) {
        setSession(newSession);
      }
    } catch (err) {
      console.error('[ProjectChatTab] New chat error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session, project.id, project.name, projectAgentIds, endSession, createSession]);

  // End the current chat session
  const handleEndChat = useCallback(async () => {
    if (!session) return;

    try {
      await endSession(session.id);
      // Reset to allow re-initialization
      setSession(null);
      initializedRef.current = false;
      await loadSession();
    } catch (err) {
      console.error('[ProjectChatTab] End chat error:', err);
    }
  }, [session, endSession, loadSession]);

  // Keep session in sync with store (in case realtime updates it)
  const storeSession = useBoardroomStore((s) =>
    s.sessions.find((sess) => sess.id === session?.id)
  );
  const activeSession = storeSession || session;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-zinc-500">Setting up chat...</p>
        </div>
      </div>
    );
  }

  if (error || !activeSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-zinc-400 mb-2">{error || 'No chat session available'}</p>
          {projectAgentIds.length === 0 && (
            <p className="text-xs text-zinc-600">
              Add agents to your project team in the Setup tab to start chatting.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <BoardroomChatView
      session={activeSession}
      onNewChat={handleNewChat}
      onEndChat={handleEndChat}
    />
  );
}
