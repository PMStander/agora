import { lazy, Suspense, useCallback } from 'react';
import { useBoardroomStore } from '../../stores/boardroom';
import { MeetTheTeam } from './MeetTheTeam';
import { BoardroomView } from './BoardroomView';
import { useBoardroom } from '../../hooks/useBoardroom';
import { useBoardroomOrchestrator } from '../../hooks/useBoardroomOrchestrator';
import { useBoardroomPrep } from '../../hooks/useBoardroomPrep';
import { useBoardroomAutoStart } from '../../hooks/useBoardroomAutoStart';
import type { BoardroomSessionMetadata } from '../../types/boardroom';

const GrowthLog = lazy(() => import('./GrowthLog').then((m) => ({ default: m.GrowthLog })));

export function TeamsTab() {
  const activeView = useBoardroomStore((s) => s.activeView);
  const setActiveView = useBoardroomStore((s) => s.setActiveView);
  const { createSession, startSession, endSession, fetchMessages } = useBoardroom();
  const { runSession, stopSession } = useBoardroomOrchestrator();
  const { startPreparation } = useBoardroomPrep();
  
  // Enable auto-start for scheduled sessions
  useBoardroomAutoStart(runSession);

  const handleCreateSession = useCallback(
    async (data: Parameters<typeof createSession>[0] & { metadata: BoardroomSessionMetadata }) => {
      const session = await createSession(data);
      if (!session) return;

      const prep = data.metadata?.preparation;
      if (prep?.assignments?.length) {
        startPreparation(session.id, prep.assignments, {
          title: data.title,
          topic: data.topic,
          entityRefs: data.metadata.entity_references || [],
          attachments: data.metadata.attachments || [],
        });
      }
    },
    [createSession, startPreparation]
  );

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
        <button
          onClick={() => setActiveView('growth-log')}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
            ${activeView === 'growth-log'
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }
          `}
        >
          Growth Log
        </button>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'meet-the-team' ? (
          <MeetTheTeam />
        ) : activeView === 'boardroom' ? (
          <BoardroomView
            onCreateSession={handleCreateSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onFetchMessages={fetchMessages}
          />
        ) : (
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-zinc-500">Loading...</div>}>
            <GrowthLog />
          </Suspense>
        )}
      </div>
    </div>
  );
}
