import { useEffect, useState, useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage, type ConnectionStatus } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';

const SESSION_NAMESPACE = 'skills-v2';

function sessionKeyForAgent(agentId: string): string {
  return `agent:${agentId}:${SESSION_NAMESPACE}`;
}

export type SubAgentRunState = 'queued' | 'running' | 'completed' | 'error';

export interface SubAgentRunEvent {
  runId: string;
  agentId: string;
  state: SubAgentRunState;
  text?: string;
  error?: string;
}

/**
 * Extract text from an Anthropic-format message.
 * Handles both string content and content block arrays.
 */
function extractText(message: any): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('');
  }
  // Try .text directly
  if (typeof message.text === 'string') return message.text;
  return '';
}

function extractReasoning(message: any): string {
  if (!message) return '';
  if (typeof message.reasoning === 'string') return message.reasoning;
  if (typeof message.reasoning_content === 'string') return message.reasoning_content;
  if (typeof message.thinking === 'string') return message.thinking;
  if (typeof message.analysis === 'string') return message.analysis;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c && (c.type === 'thinking' || c.type === 'reasoning' || c.type === 'analysis'))
      .map((c: any) => {
        if (typeof c.thinking === 'string') return c.thinking;
        if (typeof c.text === 'string') return c.text;
        if (typeof c.reasoning === 'string') return c.reasoning;
        if (typeof c.content === 'string') return c.content;
        return '';
      })
      .join('');
  }
  return '';
}

function mergeDeltaBuffer(previous: string, incoming: string): string {
  if (!incoming) return previous;
  if (!previous) return incoming;

  // Some gateways stream cumulative text, others stream chunks.
  if (incoming.startsWith(previous)) return incoming;
  if (previous.startsWith(incoming)) return previous;
  return previous + incoming;
}

export function useOpenClaw() {
  const [status, setStatus] = useState<ConnectionStatus>(openclawClient.status);
  const [connectionError, setConnectionError] = useState<string | null>(openclawClient.error);
  const streamBufferRef = useRef<string>('');
  const thinkingBufferRef = useRef<string>('');

  // Track the active run: which agent + runId we're streaming for
  const activeRunRef = useRef<{ agentId: string; runId: string } | null>(null);
  const subAgentRunsRef = useRef<Map<string, { agentId: string }>>(new Map());
  const subAgentRunAliasesRef = useRef<Map<string, string>>(new Map());
  const subAgentListenersRef = useRef<Set<(event: SubAgentRunEvent) => void>>(new Set());
  
  const { addMessage, updateLastMessage, setConnected, setLoading, activeAgentId, clearMessages } = useAgentStore();

  // Track which agents have had history loaded
  const historyLoadedForRef = useRef<Set<string>>(new Set());

  const emitSubAgentEvent = useCallback((event: SubAgentRunEvent) => {
    for (const listener of subAgentListenersRef.current) {
      listener(event);
    }
  }, []);

  const cleanupSubAgentRun = useCallback((localRunId: string) => {
    subAgentRunsRef.current.delete(localRunId);
    for (const [alias, id] of subAgentRunAliasesRef.current.entries()) {
      if (id === localRunId) {
        subAgentRunAliasesRef.current.delete(alias);
      }
    }
  }, []);

  // Load history for the active agent when it changes
  useEffect(() => {
    const sessionKey = sessionKeyForAgent(activeAgentId);
    if (openclawClient.isConnected && !historyLoadedForRef.current.has(sessionKey)) {
      loadHistory(sessionKey, activeAgentId).catch(console.error);
      historyLoadedForRef.current.add(sessionKey);
    }
  }, [activeAgentId]);

  // Subscribe to status changes and try to connect if disconnected
  useEffect(() => {
    const unsubStatus = openclawClient.onStatusChange((newStatus) => {
      console.log('[useOpenClaw] Status changed:', newStatus);
      setStatus(newStatus);
      setConnected(newStatus === 'connected');
      setConnectionError(openclawClient.error);
    });

    // Try to connect if we're disconnected when component mounts
    if (openclawClient.status === 'disconnected' || openclawClient.status === 'error') {
      console.log('[useOpenClaw] Initial status is', openclawClient.status, '- attempting connect');
      openclawClient.connect().catch(err => {
        console.error('[useOpenClaw] Connect failed:', err);
      });
    }

    const unsubMessage = openclawClient.onMessage((msg: OpenClawMessage) => {
      if (msg.type === 'event' && msg.event === 'chat') {
        const payload = msg.payload as any;
        const eventRunId = payload.runId;

        // Track events for sub-agent runs launched from the sidebar.
        if (typeof eventRunId === 'string' && eventRunId) {
          const localRunId = subAgentRunAliasesRef.current.get(eventRunId)
            ?? (subAgentRunsRef.current.has(eventRunId) ? eventRunId : undefined);
          if (localRunId) {
            const run = subAgentRunsRef.current.get(localRunId);
            if (run) {
              const text = extractText(payload.message);
              if (payload.state === 'delta') {
                emitSubAgentEvent({
                  runId: localRunId,
                  agentId: run.agentId,
                  state: 'running',
                  text,
                });
              }
              if (payload.state === 'final') {
                emitSubAgentEvent({
                  runId: localRunId,
                  agentId: run.agentId,
                  state: 'completed',
                  text,
                });
                cleanupSubAgentRun(localRunId);
              }
              if (payload.state === 'error' || payload.state === 'aborted') {
                emitSubAgentEvent({
                  runId: localRunId,
                  agentId: run.agentId,
                  state: 'error',
                  error: payload.errorMessage || `Run ${payload.state}`,
                  text,
                });
                cleanupSubAgentRun(localRunId);
              }
            }
          }
        }
        
        // Only process events that match our active run
        // This prevents WhatsApp/other channel responses from bleeding in
        if (!activeRunRef.current) {
          console.log('[useOpenClaw] Ignoring chat event - no active run. runId:', eventRunId);
          return;
        }
        
        if (eventRunId && activeRunRef.current.runId && eventRunId !== activeRunRef.current.runId) {
          console.log('[useOpenClaw] Ignoring chat event - runId mismatch. Expected:', activeRunRef.current.runId, 'Got:', eventRunId);
          return;
        }

        const targetAgent = activeRunRef.current.agentId;

        if (payload.state === 'delta') {
          const text = extractText(payload.message);
          const reasoning = extractReasoning(payload.message);
          if (text) {
            const merged = mergeDeltaBuffer(streamBufferRef.current, text);
            streamBufferRef.current = merged;
            updateLastMessage(targetAgent, { content: merged });
          }
          if (reasoning) {
            const mergedReasoning = mergeDeltaBuffer(thinkingBufferRef.current, reasoning);
            thinkingBufferRef.current = mergedReasoning;
            updateLastMessage(targetAgent, { reasoning: mergedReasoning });
          }
        }

        if (payload.state === 'final') {
          const text = extractText(payload.message);
          const reasoning = extractReasoning(payload.message);
          const finalContent = mergeDeltaBuffer(streamBufferRef.current, text);
          const finalReasoning = mergeDeltaBuffer(thinkingBufferRef.current, reasoning);
          updateLastMessage(targetAgent, {
            content: finalContent,
            reasoning: finalReasoning || undefined,
          });
          setLoading(false);
          streamBufferRef.current = '';
          thinkingBufferRef.current = '';
          activeRunRef.current = null;
        }

        if (payload.state === 'error' || payload.state === 'aborted') {
          const errorText = payload.errorMessage || 'Response was ' + payload.state;
          updateLastMessage(targetAgent, { content: errorText, reasoning: '' });
          setLoading(false);
          streamBufferRef.current = '';
          thinkingBufferRef.current = '';
          activeRunRef.current = null;
        }
      }
    });

    return () => {
      unsubStatus();
      unsubMessage();
    };
  }, [cleanupSubAgentRun, emitSubAgentEvent, setConnected, setLoading, updateLastMessage]);

  const connect = useCallback(() => {
    return openclawClient.connect();
  }, []);

  const loadHistory = useCallback(async (sessionKey?: string, targetAgentId?: string) => {
    const agentId = targetAgentId || activeAgentId;
    const resolvedSessionKey = sessionKey || sessionKeyForAgent(agentId);
    try {
      const result = await openclawClient.send('chat.history', {
        sessionKey: resolvedSessionKey,
        limit: 50,
      }) as any;
      if (result?.messages && Array.isArray(result.messages)) {
        console.log('[useOpenClaw] Loaded history:', result.messages.length, 'messages for agent', agentId, 'session', resolvedSessionKey);
        // Clear existing messages before loading history to avoid duplicates
        clearMessages(agentId);
        for (const msg of result.messages) {
          const text = extractText(msg);
          if (text && (msg.role === 'user' || msg.role === 'assistant')) {
            const reasoning = extractReasoning(msg);
            addMessage(agentId, {
              role: msg.role,
              content: text,
              reasoning: reasoning || undefined,
            });
          }
        }
      }
    } catch (err) {
      console.error('[useOpenClaw] Failed to load history:', err);
    }
  }, [activeAgentId, addMessage, clearMessages]);

  const sendMessage = useCallback(async (message: string, agentId?: string) => {
    const targetAgent = agentId || activeAgentId;
    const sessionKey = sessionKeyForAgent(targetAgent);
    
    // Generate idempotency key (also used as runId tracking)
    const idempotencyKey = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Add user message immediately (show the original, not the wrapped version)
    addMessage(targetAgent, {
      role: 'user',
      content: message,
    });

    // Add placeholder for assistant response
    addMessage(targetAgent, {
      role: 'assistant',
      content: '',
      agentId: targetAgent,
    });

    setLoading(true);
    streamBufferRef.current = '';
    
    // Pre-set the active run with the idempotency key so we can match events
    // The actual runId from the ack will replace this
    activeRunRef.current = { agentId: targetAgent, runId: idempotencyKey };

    try {
      const result = await openclawClient.send('chat.send', {
        sessionKey,
        message,
        deliver: false,
        idempotencyKey,
      }) as any;
      
      console.log('[useOpenClaw] chat.send ack:', result);
      
      // Update with the actual runId from the server
      const serverRunId = result?.runId || idempotencyKey;
      activeRunRef.current = { agentId: targetAgent, runId: serverRunId };
      console.log('[useOpenClaw] Tracking runId:', serverRunId, 'for agent:', targetAgent);
    } catch (err) {
      setLoading(false);
      activeRunRef.current = null;
      updateLastMessage(targetAgent, { content: 'Error: ' + String(err), reasoning: '' });
    }
  }, [activeAgentId, addMessage, setLoading, updateLastMessage]);

  const spawnSubAgent = useCallback(async (runId: string, agentId: string, task: string): Promise<void> => {
    subAgentRunsRef.current.set(runId, { agentId });
    subAgentRunAliasesRef.current.set(runId, runId);
    emitSubAgentEvent({ runId, agentId, state: 'queued' });

    try {
      const result = await openclawClient.send('chat.send', {
        sessionKey: sessionKeyForAgent(agentId),
        message: task,
        deliver: false,
        idempotencyKey: runId,
      }) as { runId?: string } | undefined;

      const serverRunId = result?.runId;
      if (serverRunId && serverRunId !== runId) {
        subAgentRunAliasesRef.current.set(serverRunId, runId);
      }
    } catch (err) {
      emitSubAgentEvent({
        runId,
        agentId,
        state: 'error',
        error: String(err),
      });
      cleanupSubAgentRun(runId);
      throw err;
    }
  }, [cleanupSubAgentRun, emitSubAgentEvent]);

  const onSubAgentRunEvent = useCallback((handler: (event: SubAgentRunEvent) => void) => {
    subAgentListenersRef.current.add(handler);
    return () => {
      subAgentListenersRef.current.delete(handler);
    };
  }, []);

  return {
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    connectionError,
    connect,
    sendMessage,
    spawnSubAgent,
    onSubAgentRunEvent,
    loadHistory,
  };
}
