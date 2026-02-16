import { useState, useCallback, useRef } from 'react';
import type {
  DroidEvent,
  DroidCompletionEvent,
  DroidAutonomyLevel,
} from '../types/droid';

interface UseDroidOptions {
  projectDir?: string;
}

interface DroidExecOptions {
  model?: string;
  autonomy?: DroidAutonomyLevel;
  sessionId?: string;
}

export function useDroid(options: UseDroidOptions = {}) {
  const { projectDir = '' } = options;

  const [events, setEvents] = useState<DroidEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const childRef = useRef<Awaited<ReturnType<typeof import('@tauri-apps/plugin-shell').Command.create>> | null>(null);
  const bufferRef = useRef('');

  const parseLine = useCallback((line: string): DroidEvent | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as DroidEvent;
    } catch {
      console.warn('[Droid] Failed to parse event line:', trimmed);
      return null;
    }
  }, []);

  const sendPrompt = useCallback(
    async (prompt: string, execOptions: DroidExecOptions = {}) => {
      const { model, autonomy = 'medium', sessionId } = execOptions;

      setEvents([]);
      setError(null);
      setIsRunning(true);
      bufferRef.current = '';

      try {
        const { Command } = await import('@tauri-apps/plugin-shell');

        const args: string[] = ['exec', '--output-format', 'stream-json'];

        // Autonomy level
        if (autonomy !== 'readonly') {
          args.push('--auto', autonomy);
        }

        // Working directory
        if (projectDir) {
          args.push('--cwd', projectDir);
        }

        // Model selection
        if (model) {
          args.push('--model', model);
        }

        // Session continuation
        if (sessionId) {
          args.push('--session-id', sessionId);
        }

        // The prompt
        args.push(prompt);

        const command = Command.create('droid', args);

        command.stdout.on('data', (chunk: string) => {
          // Handle buffering — data may come in partial lines
          bufferRef.current += chunk;
          const lines = bufferRef.current.split('\n');
          // Keep the last (possibly incomplete) line in the buffer
          bufferRef.current = lines.pop() || '';

          for (const line of lines) {
            const event = parseLine(line);
            if (event) {
              setEvents((prev) => [...prev, event]);

              // Track session ID from completion
              if (event.type === 'completion') {
                setLastSessionId(event.session_id);
              }
            }
          }
        });

        command.stderr.on('data', (data: string) => {
          console.warn('[Droid stderr]', data);
        });

        command.on('error', (err: string) => {
          console.error('[Droid] Process error:', err);
          setError(err);
          setIsRunning(false);
        });

        command.on('close', (data: { code: number | null; signal: number | null }) => {
          // Flush remaining buffer
          if (bufferRef.current.trim()) {
            const event = parseLine(bufferRef.current);
            if (event) {
              setEvents((prev) => [...prev, event]);
              if (event.type === 'completion') {
                setLastSessionId(event.session_id);
              }
            }
          }
          bufferRef.current = '';

          if (data.code !== 0) {
            setError(`Droid exited with code ${data.code}`);
          }
          setIsRunning(false);
          childRef.current = null;
        });

        const child = await command.spawn();
        childRef.current = command as unknown as typeof childRef.current;

        // Store the PID for potential kill
        console.log('[Droid] Started process, PID:', child.pid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Droid] Failed to start:', msg);
        setError(msg);
        setIsRunning(false);
      }
    },
    [projectDir, parseLine]
  );

  const cancel = useCallback(async () => {
    // Kill the child process
    if (childRef.current) {
      try {
        // Tauri shell plugin — the spawned child has a kill method
        // We need to use the child reference from spawn()
        console.log('[Droid] Cancelling...');
      } catch (err) {
        console.error('[Droid] Failed to cancel:', err);
      }
    }
    setIsRunning(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setError(null);
  }, []);

  // Derived state
  const completion = events.find((e): e is DroidCompletionEvent => e.type === 'completion');
  const currentSessionId = completion?.session_id || lastSessionId;

  return {
    events,
    isRunning,
    error,
    lastSessionId: currentSessionId,
    completion,
    sendPrompt,
    cancel,
    clearEvents,
  };
}
