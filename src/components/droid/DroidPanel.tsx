import { useState, useRef, useEffect } from 'react';
import { useDroid } from '../../hooks/useDroid';
import { DroidEventStream } from './DroidEventStream';
import { cn } from '../../lib/utils';
import {
  DROID_BUILTIN_MODELS,
  DROID_AUTONOMY_LEVELS,
  type DroidAutonomyLevel,
} from '../../types/droid';

interface DroidPanelProps {
  projectDir?: string;
  className?: string;
}

export function DroidPanel({ projectDir, className }: DroidPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('claude-opus-4-6');
  const [autonomy, setAutonomy] = useState<DroidAutonomyLevel>('medium');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    events,
    isRunning,
    error,
    lastSessionId,
    completion,
    sendPrompt,
    cancel,
    clearEvents,
  } = useDroid({ projectDir });

  // Auto-scroll on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;

    setPrompt('');
    await sendPrompt(trimmed, { model, autonomy });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleContinue = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning || !lastSessionId) return;

    setPrompt('');
    await sendPrompt(trimmed, { model, autonomy, sessionId: lastSessionId });
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex-none border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <h2 className="text-sm font-semibold">Factory Droid</h2>
          </div>
          {events.length > 0 && (
            <button
              onClick={clearEvents}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 text-xs">
          {/* Model selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-muted-foreground">Model:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <optgroup label="Built-in">
                {DROID_BUILTIN_MODELS.filter(m => m.group === 'builtin').map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Autonomy selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-muted-foreground">Autonomy:</label>
            <select
              value={autonomy}
              onChange={(e) => setAutonomy(e.target.value as DroidAutonomyLevel)}
              disabled={isRunning}
              className="bg-muted border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DROID_AUTONOMY_LEVELS.map((level) => (
                <option key={level.value} value={level.value} title={level.description}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          {/* Project dir indicator */}
          {projectDir && (
            <div className="ml-auto text-muted-foreground/60 truncate max-w-48" title={projectDir}>
              {projectDir.replace(/^\/Users\/[^/]+\//, '~/')}
            </div>
          )}
        </div>
      </div>

      {/* Event stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 min-h-0">
        {events.length === 0 && !isRunning ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 text-sm space-y-2">
            <span className="text-4xl">🤖</span>
            <p>Send a prompt to Factory Droid</p>
            <p className="text-xs">Code analysis, refactoring, implementation, testing</p>
          </div>
        ) : (
          <DroidEventStream events={events} isRunning={isRunning} />
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex-none px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Session indicator */}
      {lastSessionId && completion && !isRunning && (
        <div className="flex-none px-4 py-1.5 bg-muted/30 border-t border-border/50 text-xs text-muted-foreground/60 flex items-center gap-2">
          <span>Session: {lastSessionId.slice(0, 8)}...</span>
          <span className="ml-auto">Press Enter to continue in this session</span>
        </div>
      )}

      {/* Input */}
      <div className="flex-none border-t border-border p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            placeholder={isRunning ? 'Droid is working...' : 'Ask Droid to analyze, build, or review code...'}
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40 min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <div className="flex flex-col gap-1">
            {lastSessionId && completion && !isRunning ? (
              <button
                onClick={handleContinue}
                disabled={!prompt.trim() || isRunning}
                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Continue in current session"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={isRunning ? cancel : handleSubmit}
                disabled={!isRunning && !prompt.trim()}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                  isRunning
                    ? 'bg-red-500/80 text-white hover:bg-red-500'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isRunning ? 'Stop' : 'Send'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
