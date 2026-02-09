import { openclawClient, type OpenClawMessage } from './openclawClient';

export interface AgentRunOptions {
  sessionNamespace?: string;
  timeoutMs?: number;
  onDelta?: (text: string) => void;
}

export interface AgentRunResult {
  runId: string;
  text: string;
}

const DEFAULT_SESSION_NAMESPACE = 'mission-statement';
const DEFAULT_TIMEOUT_MS = 180_000;

function extractText(message: unknown): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null) {
    const obj = message as Record<string, unknown>;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.text === 'string') return obj.text;
    if (Array.isArray(obj.content)) {
      return obj.content
        .map((chunk) => {
          if (!chunk || typeof chunk !== 'object') return '';
          const entry = chunk as Record<string, unknown>;
          return entry.type === 'text' && typeof entry.text === 'string'
            ? entry.text
            : '';
        })
        .join('');
    }
  }
  return '';
}

function mergeDelta(previous: string, incoming: string): string {
  if (!incoming) return previous;
  if (!previous) return incoming;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.startsWith(incoming)) return previous;
  return previous + incoming;
}

export async function runAgentPrompt(
  agentId: string,
  prompt: string,
  options: AgentRunOptions = {}
): Promise<AgentRunResult> {
  await openclawClient.connect();

  const namespace = options.sessionNamespace || DEFAULT_SESSION_NAMESPACE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const idempotencyKey = `run-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionKey = `agent:${agentId}:${namespace}`;
  const knownRunIds = new Set<string>([idempotencyKey]);
  let buffer = '';

  return new Promise<AgentRunResult>((resolve, reject) => {
    let isDone = false;
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Run timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      window.clearTimeout(timeout);
      offMessage();
    };

    const offMessage = openclawClient.onMessage((msg: OpenClawMessage) => {
      if (isDone) return;
      if (msg.type !== 'event' || msg.event !== 'chat') return;

      const payload = msg.payload as Record<string, unknown> | undefined;
      if (!payload) return;
      const eventRunId = typeof payload.runId === 'string' ? payload.runId : '';
      if (!eventRunId || !knownRunIds.has(eventRunId)) return;

      const state = typeof payload.state === 'string' ? payload.state : '';
      const text = extractText(payload.message);

      if (state === 'delta') {
        if (text) {
          buffer = mergeDelta(buffer, text);
          options.onDelta?.(buffer);
        }
        return;
      }

      if (state === 'error' || state === 'aborted') {
        cleanup();
        reject(new Error(String(payload.errorMessage || `Run ${state}`)));
        return;
      }

      if (state !== 'final') return;

      buffer = mergeDelta(buffer, text);
      cleanup();
      resolve({
        runId: eventRunId,
        text: buffer,
      });
    });

    openclawClient.send('chat.send', {
      sessionKey,
      message: prompt,
      deliver: false,
      idempotencyKey,
    })
      .then((ack) => {
        const response = ack as { runId?: string } | undefined;
        if (response?.runId) knownRunIds.add(response.runId);
      })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}
