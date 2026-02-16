// ─── Boardroom User Input Component ──────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { useBoardroomStore } from '../../stores/boardroom';
import { useBoardroom } from '../../hooks/useBoardroom';
import { useBoardroomOrchestrator } from '../../hooks/useBoardroomOrchestrator';
import { hasUserParticipation } from '../../lib/boardroomUserParticipation';
import type { BoardroomSession } from '../../types/boardroom';
import { cn } from '../../lib/utils';

const EMPTY_MESSAGES: any[] = [];

interface BoardroomUserInputProps {
  session: BoardroomSession;
}

export function BoardroomUserInput({ session }: BoardroomUserInputProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { addMessageToSession } = useBoardroom();
  const { pauseSession, resumeSession } = useBoardroomOrchestrator();

  const isOrchestrating = useBoardroomStore((s) => s.isOrchestrating);
  const isPaused = useBoardroomStore((s) => s.isPaused);
  const waitingForUser = useBoardroomStore((s) => s.waitingForUser);
  const userRaisedHand = useBoardroomStore((s) => s.userRaisedHand);
  const setUserRaisedHand = useBoardroomStore((s) => s.setUserRaisedHand);
  const currentTurnCount = session.turn_count;
  const sessionMessages = useBoardroomStore((s) => s.messages[session.id]);
  const messages = sessionMessages ?? EMPTY_MESSAGES;

  // Check if user can participate
  const canParticipate = hasUserParticipation(session);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Don't show if session is closed or user can't participate
  // (moved below all hooks to avoid React error #300 — hooks order violation)
  if (session.status === 'closed' || !canParticipate) {
    return null;
  }

  const handleSubmit = async () => {
    if (!input.trim() || !isOrchestrating) return;

    const messageContent = input.trim();
    setInput('');
    setIsTyping(false);

    // Determine turn number (user messages can be interjections or their turn)
    let turnNumber = currentTurnCount + 1;
    
    // If waiting for user, use the next turn number
    // Otherwise, this is an interjection (doesn't count as official turn, but inserted)
    if (!waitingForUser) {
      // Interjection - use a fractional turn number or insert between turns
      // For simplicity, we'll use the current turn count
      turnNumber = messages.length + 1;
    }

    // Save user message
    await addMessageToSession({
      session_id: session.id,
      agent_id: 'user',
      content: messageContent,
      turn_number: turnNumber,
      sender_type: 'user',
      mentions: [],
    });

    // Reset raised hand if it was set
    if (userRaisedHand) {
      setUserRaisedHand(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePause = () => {
    if (isPaused) {
      resumeSession();
    } else {
      pauseSession();
    }
  };

  const handleRaiseHand = () => {
    setUserRaisedHand(!userRaisedHand);
  };

  const getContextMessage = () => {
    if (waitingForUser) {
      return '⚡ Your turn — the team is waiting for your input';
    }
    if (userRaisedHand) {
      return "✋ Hand raised — you'll speak next in smart routing";
    }
    if (isPaused) {
      return '⏸️ Session paused — type and resume when ready';
    }
    return 'Type your message (Enter to send, Shift+Enter for new line)';
  };

  const isHighlighted = waitingForUser || userRaisedHand;

  return (
    <div className="border-t border-zinc-800 bg-zinc-900">
      {/* Context/Status bar */}
      {(waitingForUser || userRaisedHand || isPaused) && (
        <div
          className={cn(
            'px-4 py-2 text-xs font-medium border-b border-zinc-800',
            waitingForUser && 'bg-amber-500/10 text-amber-400',
            userRaisedHand && !waitingForUser && 'bg-blue-500/10 text-blue-400',
            isPaused && !waitingForUser && 'bg-zinc-700/50 text-zinc-400'
          )}
        >
          {getContextMessage()}
        </div>
      )}

      {/* Input area */}
      <div className="p-3">
        <div
          className={cn(
            'flex gap-2 items-end',
            isHighlighted && 'ring-2 ring-amber-500/50 rounded-lg p-2 -m-2'
          )}
        >
          {/* User avatar */}
          <div className="shrink-0 mb-1">
            <span className="text-lg">👤</span>
          </div>

          {/* Textarea */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setIsTyping(e.target.value.length > 0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                isOrchestrating
                  ? waitingForUser
                    ? "It's your turn..."
                    : 'Join the conversation...'
                  : 'Session not active'
              }
              disabled={!isOrchestrating}
              className={cn(
                'w-full px-3 py-2 bg-zinc-800 text-sm text-zinc-200 rounded-lg resize-none',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                'placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed',
                'max-h-32 overflow-y-auto'
              )}
              rows={1}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 shrink-0 mb-1">
            {/* Raise hand */}
            <button
              onClick={handleRaiseHand}
              disabled={!isOrchestrating || waitingForUser}
              className={cn(
                'px-2 py-1.5 text-xs rounded-lg transition-colors',
                userRaisedHand
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Raise hand to speak next (smart routing)"
            >
              ✋
            </button>

            {/* Pause/Resume */}
            <button
              onClick={handlePause}
              disabled={!isOrchestrating}
              className={cn(
                'px-2 py-1.5 text-xs rounded-lg transition-colors',
                isPaused
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={isPaused ? 'Resume session' : 'Pause session'}
            >
              {isPaused ? '▶️' : '⏸️'}
            </button>

            {/* Send */}
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || !isOrchestrating}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                'bg-amber-600 text-white hover:bg-amber-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Send
            </button>
          </div>
        </div>

        {/* Helper text */}
        {!waitingForUser && !isPaused && (
          <p className="text-[10px] text-zinc-600 mt-1.5 ml-8">
            {getContextMessage()}
          </p>
        )}
      </div>

      {/* Typing indicator for others */}
      {isTyping && (
        <div className="px-4 pb-2">
          <span className="text-[10px] text-zinc-500">Peet is typing...</span>
        </div>
      )}
    </div>
  );
}
