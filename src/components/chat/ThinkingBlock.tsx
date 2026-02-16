// ─── ThinkingBlock ──────────────────────────────────────────────────────────
// Animated collapsible for agent reasoning/thinking.
// Auto-expands during streaming, auto-collapses after completion
// (unless the user manually toggled it).
// Used by both ChatPanel (1:1) and BoardroomChatView (team chat).

import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface ThinkingBlockProps {
  reasoning: string;
  isStreaming?: boolean;
  /** Agent color class for theming (e.g. 'border-l-amber-500') — used in BoardroomChatView */
  agentColor?: string;
}

export function ThinkingBlock({ reasoning, isStreaming = false, agentColor }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevStreamingRef = useRef(isStreaming);
  const userToggledRef = useRef(false);

  // Auto-expand when streaming starts, auto-collapse when it ends (unless user toggled)
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      setIsExpanded(true);
      userToggledRef.current = false; // Reset for new streaming session
    }
    if (!isStreaming && prevStreamingRef.current) {
      // Skip auto-collapse if user manually toggled
      if (!userToggledRef.current) {
        const timer = setTimeout(() => setIsExpanded(false), 1500);
        prevStreamingRef.current = isStreaming;
        return () => clearTimeout(timer);
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Auto-scroll within the thinking block during streaming
  useEffect(() => {
    if (isStreaming && isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [reasoning, isStreaming, isExpanded]);

  if (!reasoning?.trim()) return null;

  const handleToggle = () => {
    userToggledRef.current = true;
    setIsExpanded(!isExpanded);
  };

  const accentBorder = isStreaming ? 'border-purple-500/40' : 'border-border';
  const accentBg = isStreaming ? 'bg-purple-500/5' : 'bg-background/40';
  const headerText = isStreaming ? 'text-purple-300' : 'text-muted-foreground hover:text-foreground';

  return (
    <div className={cn(
      'mt-2 rounded-lg border overflow-hidden transition-all duration-300',
      accentBorder,
      accentBg,
      // Agent color as left-border accent (e.g. 'border-l-amber-500')
      agentColor && `border-l-[3px] ${agentColor}`,
    )}>
      {/* Header — always visible, clickable */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
          headerText,
        )}
      >
        {/* Brain / lightbulb icon */}
        <svg
          className={cn('w-3.5 h-3.5 flex-shrink-0', isStreaming && 'animate-pulse')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <span className="font-medium">
          {isStreaming ? 'Thinking...' : 'Reasoning'}
        </span>
        {isStreaming && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 animate-cursor-blink"
          />
        )}
        {/* Word count badge — show during streaming (progress) and when collapsed */}
        {(!isExpanded || isStreaming) && (
          <span className="text-[10px] text-muted-foreground/50">
            {reasoning.trim().split(/\s+/).length}w
          </span>
        )}
        {/* Chevron */}
        <svg
          className={cn(
            'w-3 h-3 ml-auto flex-shrink-0 transition-transform duration-200',
            isExpanded ? 'rotate-180' : 'rotate-0'
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content — animated expand/collapse */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden',
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div
          ref={contentRef}
          className="px-3 pb-2 whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed max-h-96 overflow-y-auto"
        >
          {reasoning}
          {isStreaming && (
            <span
              className="inline-block w-[2px] h-[1em] bg-purple-400 ml-0.5 align-text-bottom animate-cursor-blink"
            />
          )}
        </div>
      </div>
    </div>
  );
}
