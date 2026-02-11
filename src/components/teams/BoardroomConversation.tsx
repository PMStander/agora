import { useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../../stores/agents';
import { useBoardroomStore, useSessionMessages } from '../../stores/boardroom';
import { getSessionPreset, type BoardroomSession, type BoardroomSessionMetadata } from '../../types/boardroom';
import { PrepFindingCard } from './PrepFindingCard';
import { PrepProgressBar } from './PrepProgressBar';

interface BoardroomConversationProps {
  session: BoardroomSession;
  onEndSession: () => void;
}

export function BoardroomConversation({ session, onEndSession }: BoardroomConversationProps) {
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const messages = useSessionMessages(session.id);
  const currentSpeakingAgentId = useBoardroomStore((s) => s.currentSpeakingAgentId);
  const isOrchestrating = useBoardroomStore((s) => s.isOrchestrating);
  const streamingContent = useBoardroomStore((s) => s.streamingContent);
  const activeSessionId = useBoardroomStore((s) => s.activeSessionId);
  const prepStatus = useBoardroomStore((s) => s.prepStatus[session.id]);
  const prepResults = useBoardroomStore((s) => s.prepResults[session.id]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFindings, setShowFindings] = useState(true);

  const preset = getSessionPreset(session.session_type);
  const isActiveSession = activeSessionId === session.id && isOrchestrating;

  // Prep data from session metadata or live store
  const metadata = session.metadata as BoardroomSessionMetadata | undefined;
  const metadataPrepResults = metadata?.preparation?.results;
  const activePrepResults = prepResults || metadataPrepResults;
  const isPreparing = session.status === 'preparing' || prepStatus === 'running';
  const hasFindings = activePrepResults?.some((r) => r.status === 'completed' && r.text);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamingContent]);

  const participantEmojis = session.participant_agent_ids
    .map((id) => agentProfiles[id]?.emoji || '?');

  return (
    <div className="flex flex-col h-full">
      {/* Session header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">{preset.icon}</span>
              <h3 className="text-sm font-semibold text-zinc-100">{session.title}</h3>
              {isActiveSession && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 animate-pulse">
                  ● LIVE
                </span>
              )}
            </div>
            {session.topic && (
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{session.topic}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">
              Turn {session.turn_count}/{session.max_turns}
            </span>
            {isActiveSession && (
              <button
                onClick={onEndSession}
                className="px-2 py-1 text-[10px] text-red-400 bg-red-500/10 rounded-md hover:bg-red-500/20 transition-colors"
              >
                End Session
              </button>
            )}
          </div>
        </div>

        {/* Participant avatars */}
        <div className="flex items-center gap-1 mt-2">
          {participantEmojis.map((emoji, i) => (
            <span
              key={i}
              className="text-sm"
              title={agentProfiles[session.participant_agent_ids[i]]?.name}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Prep progress bar (shown during preparation) */}
      {isPreparing && activePrepResults && (
        <PrepProgressBar sessionId={session.id} results={activePrepResults} />
      )}

      {/* Preparation findings (collapsible) */}
      {hasFindings && !isPreparing && (
        <div className="border-b border-zinc-800">
          <button
            onClick={() => setShowFindings((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span className="uppercase tracking-wider font-medium">
              Preparation Findings ({activePrepResults!.filter((r) => r.status === 'completed').length})
            </span>
            <span>{showFindings ? '▾' : '▸'}</span>
          </button>
          {showFindings && (
            <div className="px-4 pb-3 space-y-2">
              {activePrepResults!
                .filter((r) => r.status === 'completed' || r.status === 'error')
                .map((result) => (
                  <PrepFindingCard key={result.agent_id} result={result} />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isActiveSession && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-600">
              {session.status === 'closed'
                ? 'This session has ended.'
                : 'No messages yet. The conversation will begin...'}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const agent = agentProfiles[msg.agent_id];
          return (
            <div key={msg.id} className="flex gap-3">
              <span className="text-lg shrink-0 mt-0.5">{agent?.emoji || '?'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-zinc-300">{agent?.name || msg.agent_id}</span>
                  <span className="text-[10px] text-zinc-600">Turn {msg.turn_number}</span>
                </div>
                <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                {msg.reasoning && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-400">
                      Reasoning
                    </summary>
                    <p className="text-xs text-zinc-600 mt-1 whitespace-pre-wrap">{msg.reasoning}</p>
                  </details>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming / thinking indicator */}
        {isActiveSession && currentSpeakingAgentId && (
          <div className="flex gap-3">
            <span className="text-lg shrink-0 mt-0.5">
              {agentProfiles[currentSpeakingAgentId]?.emoji || '?'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-zinc-300">
                  {agentProfiles[currentSpeakingAgentId]?.name || currentSpeakingAgentId}
                </span>
                <span className="text-[10px] text-amber-400 animate-pulse">thinking...</span>
              </div>
              {streamingContent && (
                <div className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {streamingContent}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
