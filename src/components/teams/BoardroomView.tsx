import { useState, useEffect } from 'react';
import { useBoardroomStore } from '../../stores/boardroom';
import { SessionCard } from './SessionCard';
import { BoardroomConversation } from './BoardroomConversation';
import { CreateSessionModal } from './CreateSessionModal';
import type { BoardroomSessionType, BoardroomSessionMetadata } from '../../types/boardroom';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

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
          {/* Filter tabs */}
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
        </div>

        {/* Session list */}
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
            />
          ))}
        </div>
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
