import { useBoardroomStore } from '../../stores/boardroom';
import { MeetTheTeam } from './MeetTheTeam';
import { BoardroomView } from './BoardroomView';
import { useBoardroom } from '../../hooks/useBoardroom';
import { useBoardroomOrchestrator } from '../../hooks/useBoardroomOrchestrator';

export function TeamsTab() {
  const activeView = useBoardroomStore((s) => s.activeView);
  const setActiveView = useBoardroomStore((s) => s.setActiveView);
  const { createSession, startSession, endSession, fetchMessages } = useBoardroom();
  const { runSession, stopSession } = useBoardroomOrchestrator();

  const handleStartSession = async (sessionId: string) => {
    await startSession(sessionId);
    runSession(sessionId);
  };

  const handleEndSession = async (sessionId: string) => {
    stopSession();
    await endSession(sessionId);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-view switcher */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveView('meet-the-team')}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
            ${activeView === 'meet-the-team'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }
          `}
        >
          Meet the Team
        </button>
        <button
          onClick={() => setActiveView('boardroom')}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
            ${activeView === 'boardroom'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }
          `}
        >
          Agora Boardroom
        </button>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'meet-the-team' ? (
          <MeetTheTeam />
        ) : (
          <BoardroomView
            onCreateSession={createSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onFetchMessages={fetchMessages}
          />
        )}
      </div>
    </div>
  );
}
