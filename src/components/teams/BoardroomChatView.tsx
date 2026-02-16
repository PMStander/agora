// ─── Boardroom Chat View ─────────────────────────────────────────────────────
// Conversational chat UI for project group chat sessions.
// Extends BoardroomConversation with user input, @mentions, and styled messages.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgentStore } from '../../stores/agents';
import { useBoardroomStore, useSessionMessages } from '../../stores/boardroom';
import { useBoardroomChatOrchestrator } from '../../hooks/useBoardroomChatOrchestrator';
import { MentionAutocomplete } from '../chat/MentionAutocomplete';
import { ThinkingBlock } from '../chat/ThinkingBlock';
import type { BoardroomSession, MessageMention } from '../../types/boardroom';

// ─── Agent Color Palette ─────────────────────────────────────────────────────

const AGENT_COLORS = [
  { border: 'border-l-amber-500', name: 'text-amber-400' },
  { border: 'border-l-blue-500', name: 'text-blue-400' },
  { border: 'border-l-emerald-500', name: 'text-emerald-400' },
  { border: 'border-l-purple-500', name: 'text-purple-400' },
  { border: 'border-l-rose-500', name: 'text-rose-400' },
  { border: 'border-l-cyan-500', name: 'text-cyan-400' },
  { border: 'border-l-orange-500', name: 'text-orange-400' },
  { border: 'border-l-pink-500', name: 'text-pink-400' },
];

function getAgentColor(agentId: string, participants: string[]) {
  const idx = participants.indexOf(agentId);
  return AGENT_COLORS[idx >= 0 ? idx % AGENT_COLORS.length : 0];
}

// ─── Mention Rendering ───────────────────────────────────────────────────────

function renderMessageContent(content: string, mentions: MessageMention[]) {
  if (!mentions || mentions.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Build a lookup of mention display text → mention data for all occurrences
  const mentionsByDisplay = new Map<string, MessageMention>();
  for (const m of mentions) {
    mentionsByDisplay.set(m.display, m);
  }

  // Split content by all mention display strings, preserving order
  const parts: Array<{ text: string; mention?: MessageMention }> = [];
  let remaining = content;

  while (remaining.length > 0) {
    // Find the earliest mention occurrence in remaining text
    let earliestIdx = -1;
    let earliestMention: MessageMention | undefined;

    for (const [display, mention] of mentionsByDisplay) {
      const idx = remaining.indexOf(display);
      if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
        earliestIdx = idx;
        earliestMention = mention;
      }
    }

    if (earliestIdx === -1 || !earliestMention) {
      // No more mentions found — push the rest as plain text
      parts.push({ text: remaining });
      break;
    }

    // Push text before the mention
    if (earliestIdx > 0) {
      parts.push({ text: remaining.slice(0, earliestIdx) });
    }
    // Push the mention
    parts.push({ text: earliestMention.display, mention: earliestMention });
    remaining = remaining.slice(earliestIdx + earliestMention.display.length);
  }

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.mention) {
          const isAgent = part.mention.type === 'agent';
          return (
            <span
              key={i}
              className={`inline-flex items-center px-1 rounded text-xs font-medium cursor-pointer ${
                isAgent
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              }`}
            >
              {part.text}
            </span>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface BoardroomChatViewProps {
  session: BoardroomSession;
  onNewChat?: () => void;
  onEndChat?: () => void;
}

export function BoardroomChatView({ session, onNewChat, onEndChat }: BoardroomChatViewProps) {
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const messages = useSessionMessages(session.id);
  const currentSpeakingAgentId = useBoardroomStore((s) => s.currentSpeakingAgentId);
  const chatStreamingByAgent = useBoardroomStore((s) => s.chatStreamingByAgent);
  const chatStreamingReasoningByAgent = useBoardroomStore((s) => s.chatStreamingReasoningByAgent);

  const { sendChatMessage, cancelChat, isChatSending } = useBoardroomChatOrchestrator();

  const [inputValue, setInputValue] = useState('');
  const [mentions, setMentions] = useState<MessageMention[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollBottomRef = useRef(true);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, chatStreamingByAgent, currentSpeakingAgentId]);

  // Detect scroll position for "scroll to bottom" button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    scrollBottomRef.current = isNearBottom;
    setShowScrollButton(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      scrollBottomRef.current = true;
      setShowScrollButton(false);
    }
  }, []);

  // Send message
  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isChatSending) return;

    sendChatMessage({
      sessionId: session.id,
      content: inputValue,
      mentions,
    });

    setInputValue('');
    setMentions([]);
    scrollBottomRef.current = true;
  }, [inputValue, mentions, isChatSending, session.id, sendChatMessage]);

  // Handle keyboard in input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle mention selection from autocomplete
  const handleMentionSelect = useCallback(
    (mention: MessageMention) => {
      // Insert the mention display text at cursor position
      const textarea = inputRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBefore = inputValue.slice(0, cursorPos);
      const textAfter = inputValue.slice(cursorPos);

      // Find the @ trigger position (scan backwards for unmatched @)
      const atIdx = textBefore.lastIndexOf('@');
      if (atIdx === -1) return;

      const newText = textBefore.slice(0, atIdx) + mention.display + ' ' + textAfter;
      setInputValue(newText);
      setMentions((prev) => [...prev, mention]);

      // Focus and position cursor after the mention
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = atIdx + mention.display.length + 1;
          inputRef.current.selectionStart = newCursorPos;
          inputRef.current.selectionEnd = newCursorPos;
          inputRef.current.focus();
        }
      }, 0);
    },
    [inputValue]
  );

  // Participant emojis for header
  const participantEmojis = session.participant_agent_ids.map(
    (id) => agentProfiles[id]?.emoji || '?'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-xs font-medium text-zinc-200">Team Chat</span>
          <div className="flex items-center gap-0.5 ml-1">
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
          <span className="text-[10px] text-zinc-600">
            {session.participant_agent_ids.length} agents
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isChatSending && (
            <button
              onClick={cancelChat}
              className="px-2 py-0.5 text-[10px] text-red-400 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors"
            >
              Stop
            </button>
          )}
          {onNewChat && !isChatSending && messages.length > 0 && (
            <button
              onClick={onNewChat}
              className="px-2 py-0.5 text-[10px] text-zinc-400 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors"
              title="Start a new chat session"
            >
              New Chat
            </button>
          )}
          {onEndChat && !isChatSending && messages.length > 0 && (
            <button
              onClick={onEndChat}
              className="px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              title="End this chat session"
            >
              End
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 relative"
      >
        {messages.length === 0 && !isChatSending && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-2xl mb-2">💬</p>
              <p className="text-xs text-zinc-500">
                Start a conversation with your project team.
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Type @ to mention agents or reference entities
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender_type === 'user';
          const isSystem = msg.sender_type === 'system';
          const agent = !isUser && !isSystem ? agentProfiles[msg.agent_id] : null;
          const color = !isUser && !isSystem
            ? getAgentColor(msg.agent_id, session.participant_agent_ids)
            : null;

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-full">
                  <span className="text-[11px] text-zinc-500">{msg.content}</span>
                </div>
              </div>
            );
          }

          if (isUser) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] bg-zinc-800 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-medium text-zinc-400">You</span>
                    <span className="text-[10px] text-zinc-600">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-200 leading-relaxed">
                    {renderMessageContent(msg.content, msg.mentions || [])}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`border-l-[3px] ${color?.border || 'border-l-zinc-700'} pl-3`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm">{agent?.emoji || '?'}</span>
                <span className={`text-xs font-medium ${color?.name || 'text-zinc-300'}`}>
                  {agent?.name || msg.agent_id}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="text-sm text-zinc-300 leading-relaxed">
                {renderMessageContent(msg.content, msg.mentions || [])}
              </div>
              {msg.reasoning && (
                <ThinkingBlock
                  reasoning={msg.reasoning}
                  agentColor={color?.border}
                />
              )}
            </div>
          );
        })}

        {/* Streaming indicator */}
        {currentSpeakingAgentId && (
          <div
            className={`border-l-[3px] ${
              getAgentColor(currentSpeakingAgentId, session.participant_agent_ids).border
            } pl-3`}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm">
                {agentProfiles[currentSpeakingAgentId]?.emoji || '?'}
              </span>
              <span
                className={`text-xs font-medium ${
                  getAgentColor(currentSpeakingAgentId, session.participant_agent_ids).name
                }`}
              >
                {agentProfiles[currentSpeakingAgentId]?.name || currentSpeakingAgentId}
              </span>
              <span className="text-[10px] text-amber-400 animate-pulse">
                {chatStreamingByAgent[currentSpeakingAgentId] ? 'responding...' : 'thinking...'}
              </span>
            </div>
            {chatStreamingReasoningByAgent[currentSpeakingAgentId] && (
              <ThinkingBlock
                reasoning={chatStreamingReasoningByAgent[currentSpeakingAgentId]}
                isStreaming
                agentColor={getAgentColor(currentSpeakingAgentId, session.participant_agent_ids).border}
              />
            )}
            {chatStreamingByAgent[currentSpeakingAgentId] && (
              <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {chatStreamingByAgent[currentSpeakingAgentId]}
                <span
                  className="inline-block w-[2px] h-[1.1em] bg-amber-400 ml-0.5 align-text-bottom animate-cursor-blink"
                />
              </div>
            )}
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full shadow-lg hover:bg-zinc-700 transition-colors z-10"
          >
            ↓ New messages
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-800 px-3 py-2">
        <div className="relative">
          <MentionAutocomplete
            inputValue={inputValue}
            inputRef={inputRef}
            participantAgentIds={session.participant_agent_ids}
            onSelect={handleMentionSelect}
          />
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message the team... (@ to mention)"
              rows={1}
              disabled={isChatSending}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none disabled:opacity-50 min-h-[36px] max-h-[120px]"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isChatSending}
              className="px-3 py-2 text-xs font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Send
            </button>
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 mt-1 px-1">
          Type <span className="text-zinc-500">@</span> to mention agents or entities
          · <span className="text-zinc-500">Shift+Enter</span> for new line
        </p>
      </div>
    </div>
  );
}
