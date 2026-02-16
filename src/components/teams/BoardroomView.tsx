import { useState, useEffect, useCallback } from 'react';
import { useBoardroomStore } from '../../stores/boardroom';
import { useAgentStore } from '../../stores/agents';
import { useBoardroom } from '../../hooks/useBoardroom';
import { SessionCard } from './SessionCard';
import { BoardroomConversation } from './BoardroomConversation';
import { CreateSessionModal } from './CreateSessionModal';
import { ResolutionInbox, usePendingResolutionCount } from './ResolutionInbox';
import type { BoardroomSessionType, BoardroomSessionMetadata, BoardroomSession } from '../../types/boardroom';

interface BoardroomViewProps {
  onCreateSession: (data: {
    title: string;
    topic: string;
    session_type: BoardroomSessionType;
    participant_agent_ids: string[];
    max_turns: number;
    scheduled_at: string | null;
    metadata: BoardroomSessionMetadata;
  }) => void;
  onStartSession: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  onFetchMessages: (sessionId: string) => void;
}

export function BoardroomView({ onCreateSession, onStartSession, onEndSession, onFetchMessages }: BoardroomViewProps) {
  const sessions = useBoardroomStore((s) => s.sessions);
  const selectedSessionId = useBoardroomStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useBoardroomStore((s) => s.setSelectedSessionId);
  const isCreateModalOpen = useBoardroomStore((s) => s.isCreateSessionModalOpen);
  const setCreateModalOpen = useBoardroomStore((s) => s.setCreateSessionModalOpen);
  const isOrchestrating = useBoardroomStore((s) => s.isOrchestrating);
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const { cloneSession, deleteSession, restartSession, updateSession } = useBoardroom();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [sidebarView, setSidebarView] = useState<'sessions' | 'inbox'>('sessions');
  const pendingResolutionCount = usePendingResolutionCount();

  // Proposed sessions for the banner
  const proposedSessions = sessions.filter((s) => s.status === 'proposed');

  const handleApproveProposal = useCallback(async (session: BoardroomSession) => {
    await updateSession(session.id, { status: 'open' });
  }, [updateSession]);

  const handleDeclineProposal = useCallback(async (session: BoardroomSession) => {
    await updateSession(session.id, { status: 'declined' as any });
  }, [updateSession]);

  const handleCloneFromCard = useCallback((sessionId: string) => {
    cloneSession(sessionId);
  }, [cloneSession]);

  const handleRescheduleFromCard = useCallback((sessionId: string) => {
    // Select the session so the detail panel opens, where reschedule UI lives
    setSelectedSessionId(sessionId);
  }, [setSelectedSessionId]);

  const handleDeleteFromCard = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    if (!window.confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
    await deleteSession(sessionId);
  }, [sessions, deleteSession]);

  const handleRestartFromCard = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    if (!window.confirm(`Restart "${session.title}"? Messages will be deleted.`)) return;
    await restartSession(sessionId);
  }, [sessions, restartSession]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Fetch messages when a session is selected
  useEffect(() => {
    if (selectedSessionId) {
      onFetchMessages(selectedSessionId);
    }
  }, [selectedSessionId, onFetchMessages]);

  const filteredSessions = sessions.filter((s) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return s.status === 'active' || s.status === 'open' || s.status === 'scheduled' || s.status === 'preparing';
    return s.status === 'closed';
  }).sort((a, b) => {
    // Active sessions first, then by date
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="flex h-full">
      {/* Left: Session list */}
      <div className="w-72 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-200">Sessions</h3>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-2 py-1 text-xs font-medium bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors"
            >
              + New
            </button>
          </div>

          {/* Sidebar view toggle: Sessions | Inbox */}
          <div className="flex gap-1 mb-2 p-0.5 bg-zinc-800/50 rounded-md">
            <button
              onClick={() => setSidebarView('sessions')}
              className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                sidebarView === 'sessions'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setSidebarView('inbox')}
              className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${
                sidebarView === 'inbox'
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Inbox
              {pendingResolutionCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-amber-500 text-black">
                  {pendingResolutionCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter tabs (only for sessions view) */}
          {sidebarView === 'sessions' && (
            <div className="flex gap-1">
              {(['all', 'active', 'closed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors capitalize ${
                    statusFilter === filter
                      ? 'bg-zinc-700 text-zinc-200'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Proposed sessions banner (only in sessions view) */}
        {sidebarView === 'sessions' && proposedSessions.length > 0 && (
          <div className="mx-2 mt-2 rounded-lg border border-violet-500/30 bg-gradient-to-b from-violet-500/10 to-amber-500/5 overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-violet-500/20">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-violet-300">
                {proposedSessions.length} Proposed Session{proposedSessions.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-2 space-y-2">
              {proposedSessions.map((session) => {
                const creatorAgent = agentProfiles[session.created_by];
                const metadata = session.metadata as BoardroomSessionMetadata;
                const reason = metadata?.proposal_reason;
                return (
                  <div key={session.id} className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-sm shrink-0">{creatorAgent?.emoji || '🤖'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">
                          {creatorAgent?.name || session.created_by}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">{session.title}</div>
                        {reason && (
                          <div className="text-[10px] text-violet-300/80 mt-0.5 line-clamp-2">
                            {reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pl-6">
                      <button
                        onClick={() => handleApproveProposal(session)}
                        className="px-2 py-0.5 text-[10px] font-medium bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setSelectedSessionId(session.id)}
                        className="px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeclineProposal(session)}
                        className="px-2 py-0.5 text-[10px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Session list or Resolution Inbox */}
        {sidebarView === 'sessions' ? (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredSessions.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-4">No sessions yet</p>
            )}
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isSelected={session.id === selectedSessionId}
                onClick={() => setSelectedSessionId(session.id)}
                onClone={handleCloneFromCard}
                onReschedule={handleRescheduleFromCard}
                onDelete={handleDeleteFromCard}
                onRestart={handleRestartFromCard}
              />
            ))}
          </div>
        ) : (
          <ResolutionInbox />
        )}
      </div>

      {/* Right: Selected session or empty state */}
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            <BoardroomConversation
              session={selectedSession}
              onEndSession={() => onEndSession(selectedSession.id)}
            />
            {/* Start button for open sessions */}
            {selectedSession.status === 'open' && !isOrchestrating && (
              <div className="px-4 py-3 border-t border-zinc-800">
                <button
                  onClick={() => onStartSession(selectedSession.id)}
                  className="w-full py-2 text-sm font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors"
                >
                  Start Conversation
                </button>
              </div>
            )}
            {/* Preparing indicator */}
            {selectedSession.status === 'preparing' && (
              <div className="px-4 py-3 border-t border-zinc-800">
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Agents are preparing...
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-3">🏛️</p>
              <h3 className="text-sm font-medium text-zinc-300 mb-1">Agora Boardroom</h3>
              <p className="text-xs text-zinc-500 max-w-xs">
                Select a session from the list or create a new one to start a multi-agent conversation.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create session modal */}
      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreateSession={onCreateSession}
      />
    </div>
  );
}
