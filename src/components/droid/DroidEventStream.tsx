import { useState } from 'react';
import type { DroidEvent } from '../../types/droid';
import { cn } from '../../lib/utils';

interface DroidEventStreamProps {
  events: DroidEvent[];
  isRunning: boolean;
}

function ToolCallCard({ event, result }: {
  event: Extract<DroidEvent, { type: 'tool_call' }>;
  result?: Extract<DroidEvent, { type: 'tool_result' }>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1 border border-border rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          result ? (result.isError ? 'bg-red-500' : 'bg-green-500') : 'bg-yellow-500 animate-pulse'
        )} />
        <span className="font-mono text-muted-foreground">{event.toolName}</span>
        <span className="ml-auto text-muted-foreground/60">{expanded ? '[-]' : '[+]'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 space-y-2">
          <div>
            <div className="text-muted-foreground/70 mb-0.5">Parameters:</div>
            <pre className="text-[11px] bg-background p-2 rounded overflow-x-auto max-h-32">
              {JSON.stringify(event.parameters, null, 2)}
            </pre>
          </div>
          {result && (
            <div>
              <div className={cn('mb-0.5', result.isError ? 'text-red-400' : 'text-muted-foreground/70')}>
                {result.isError ? 'Error:' : 'Result:'}
              </div>
              <pre className="text-[11px] bg-background p-2 rounded overflow-x-auto max-h-48 whitespace-pre-wrap">
                {result.value}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DroidEventStream({ events, isRunning }: DroidEventStreamProps) {
  // Build tool call → result map
  const toolResults = new Map<string, Extract<DroidEvent, { type: 'tool_result' }>>();
  for (const e of events) {
    if (e.type === 'tool_result') {
      toolResults.set(e.id, e);
    }
  }

  return (
    <div className="space-y-3">
      {events.map((event, i) => {
        switch (event.type) {
          case 'system':
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground/60 px-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Droid initialized &mdash; {event.model} &mdash; {event.tools.length} tools</span>
              </div>
            );

          case 'message':
            if (event.role === 'user') {
              return (
                <div key={i} className="flex justify-end px-2">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 bg-primary text-primary-foreground text-sm">
                    <span className="whitespace-pre-wrap">{event.text}</span>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="flex justify-start px-2">
                <div className="max-w-[85%] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>🤖</span>
                    <span className="font-medium">Droid</span>
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-2.5 bg-muted text-sm">
                    <span className="whitespace-pre-wrap">{event.text}</span>
                  </div>
                </div>
              </div>
            );

          case 'tool_call':
            return (
              <div key={i} className="px-4">
                <ToolCallCard event={event} result={toolResults.get(event.id)} />
              </div>
            );

          case 'tool_result':
            // Rendered as part of tool_call
            return null;

          case 'completion':
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground/60 px-2 pt-2 border-t border-border/50">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span>Completed in {(event.durationMs / 1000).toFixed(1)}s &mdash; {event.numTurns} turns</span>
                {event.usage && (
                  <span className="ml-auto">
                    {event.usage.input_tokens + event.usage.output_tokens} tokens
                  </span>
                )}
              </div>
            );

          default:
            return null;
        }
      })}

      {isRunning && events.length > 0 && !events.some(e => e.type === 'completion') && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
          <div className="flex gap-1">
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Droid is working...</span>
        </div>
      )}
    </div>
  );
}
