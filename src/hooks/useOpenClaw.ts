import { useEffect, useState, useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage, type ConnectionStatus } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';
import { recallContextForAgent, recallEntityContext } from '../lib/memoryIntelligence/semanticRecall';
import { storeEmbedding } from '../lib/memoryIntelligence/embeddingService';
import { extractHandoffIntent, executeHandoffIntent, buildAgentRoster, HANDOFF_SYSTEM_PROMPT } from '../lib/handoffExecution';
import { buildProjectContextInjection } from '../lib/projectContextBuilder';
import { useProjectsStore } from '../stores/projects';

const SESSION_NAMESPACE = 'skills-v2';

/** Maximum time (ms) to wait for a run to complete before force-resetting isLoading. */
const STALE_RUN_TIMEOUT_MS = 120_000;

/** Regex to detect A2UI JSON blocks embedded in agent text responses. */
const A2UI_JSON_LINE = /^\s*\{[^}]*"type"\s*:\s*"(?:surfaceUpdate|dataModelUpdate|beginRendering|deleteSurface)"[^]*\}\s*$/;

/**
 * Strip A2UI JSON blocks from displayed chat text.
 * Agents embed JSON on standalone lines; we remove them so the user
 * only sees the conversational part of the reply.
 */
function stripA2UIBlocks(text: string): string {
  if (!text) return text;
  // Quick bail: if no A2UI keywords at all, skip the line-by-line scan.
  if (!/(surfaceUpdate|dataModelUpdate|beginRendering|deleteSurface)/.test(text)) return text;

  const lines = text.split('\n');
  const kept: string[] = [];
  let inCodeFence = false;
  let fenceHasA2UI = false;
  let fenceLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Track code fences (```json ... ```)
    if (trimmed.startsWith('```')) {
      if (!inCodeFence) {
        inCodeFence = true;
        fenceHasA2UI = false;
        fenceLines = [line];
        continue;
      } else {
        // End of code fence
        fenceLines.push(line);
        inCodeFence = false;
        if (!fenceHasA2UI) {
          // Keep non-A2UI code fences
          kept.push(...fenceLines);
        }
        fenceLines = [];
        continue;
      }
    }

    if (inCodeFence) {
      fenceLines.push(line);
      // Check if this line inside the fence is an A2UI JSON block
      if (A2UI_JSON_LINE.test(trimmed)) {
        fenceHasA2UI = true;
      }
      continue;
    }

    // Outside code fences: check standalone JSON lines
    if (trimmed.startsWith('{') && A2UI_JSON_LINE.test(trimmed)) {
      continue; // Strip this line
    }

    kept.push(line);
  }

  // If we ended inside an unclosed fence, keep the lines
  if (inCodeFence && fenceLines.length > 0) {
    kept.push(...fenceLines);
  }

  // Clean up excessive blank lines left by stripping
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sessionKeyForAgent(agentId: string, version: number = 0): string {
  const versionSuffix = version > 0 ? `-ctx${version}` : '';
  return `agent:${agentId}:${SESSION_NAMESPACE}${versionSuffix}`;
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
  // Cumulative: incoming is the full response so far (supersedes previous)
  if (incoming.startsWith(previous)) return incoming;
  // Stale/duplicate: previous already contains incoming
  if (previous.startsWith(incoming)) return previous;

  // Heuristic: if the incoming text is longer than what we'd expect from a
  // single chunk AND it shares a significant prefix with previous, the
  // gateway is in cumulative mode but minor formatting differences caused
  // the exact startsWith check to fail. Use the longer text.
  if (incoming.length > previous.length * 0.8) {
    return incoming;
  }

  // Append mode: gateway sends just the new token/chunk
  return previous + incoming;
}

export function useOpenClaw() {
  const [status, setStatus] = useState<ConnectionStatus>(openclawClient.status);
  const [connectionError, setConnectionError] = useState<string | null>(openclawClient.error);
  const streamBufferRef = useRef<string>('');
  const thinkingBufferRef = useRef<string>('');

  // Track the active run: which agent + runId we're streaming for
  const activeRunRef = useRef<{ agentId: string; runId: string } | null>(null);
  const staleRunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subAgentRunsRef = useRef<Map<string, { agentId: string }>>(new Map());
  const subAgentRunAliasesRef = useRef<Map<string, string>>(new Map());
  const subAgentListenersRef = useRef<Set<(event: SubAgentRunEvent) => void>>(new Set());
  
  const addMessage = useAgentStore((s) => s.addMessage);
  const updateLastMessage = useAgentStore((s) => s.updateLastMessage);
  const setConnected = useAgentStore((s) => s.setConnected);
  const setLoading = useAgentStore((s) => s.setLoading);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const getSessionVersion = useAgentStore((s) => s.getSessionVersion);

  // Track which agents have had history loaded
  const historyLoadedForRef = useRef<Set<string>>(new Set());

  // Stable ref to sendMessage for use in onMessage handler (avoids circular deps)
  const sendMessageRef = useRef<(message: string, agentId: string) => Promise<void>>(
    async () => {},
  );

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
    const version = getSessionVersion(activeAgentId);
    const sessionKey = sessionKeyForAgent(activeAgentId, version);
    if (openclawClient.isConnected && !historyLoadedForRef.current.has(sessionKey)) {
      loadHistory(sessionKey, activeAgentId).catch(console.error);
      historyLoadedForRef.current.add(sessionKey);
    }
  }, [activeAgentId, getSessionVersion]);

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
          const rawContent = mergeDeltaBuffer(streamBufferRef.current, text);
          const finalReasoning = mergeDeltaBuffer(thinkingBufferRef.current, reasoning);

          // Extract handoff intent BEFORE stripping A2UI blocks
          const { cleaned: noHandoff, intent: handoffIntent } = extractHandoffIntent(rawContent);

          // Strip embedded A2UI JSON blocks from visible chat text.
          // The A2UI hook extracts these separately from the raw payload.
          const finalContent = stripA2UIBlocks(noHandoff);
          updateLastMessage(targetAgent, {
            content: finalContent,
            reasoning: finalReasoning || undefined,
          });
          setLoading(false);
          streamBufferRef.current = '';
          thinkingBufferRef.current = '';

          // ── Auto-embed agent response (fire-and-forget) ──────────────
          if (finalContent && finalContent.length > 20) {
            const responseMsgId = `agent-${activeRunRef.current?.runId || Date.now()}`;
            storeEmbedding('chat_message', responseMsgId, targetAgent, finalContent).catch(() => {});
          }

          activeRunRef.current = null;
          if (staleRunTimerRef.current) {
            clearTimeout(staleRunTimerRef.current);
            staleRunTimerRef.current = null;
          }

          // ── Execute smart handoff if agent requested one ──────────────
          if (handoffIntent) {
            console.log('[useOpenClaw] Handoff intent detected from', targetAgent, '→', handoffIntent.target_agent_id, '| action:', handoffIntent.action);
            executeHandoffIntent(handoffIntent, targetAgent, sendMessageRef.current)
              .then((result) => {
                const { addMessage: addMsg } = useAgentStore.getState();
                if (result.success) {
                  console.log('[useOpenClaw] Handoff executed successfully:', result.requestingName, '→', result.targetName);
                  // Add system confirmation to requesting agent's chat
                  addMsg(targetAgent, {
                    role: 'system',
                    content: `Handoff to **${result.targetName}** executed successfully (${result.action}).${result.missionId ? ' Mission created.' : ''}`,
                  });
                } else {
                  console.error('[useOpenClaw] Handoff execution failed:', result.error);
                  addMsg(targetAgent, {
                    role: 'system',
                    content: `Handoff to **${handoffIntent.target_agent_id}** failed: ${result.error ?? 'Unknown error'}. Please try again or create the task manually.`,
                  });
                }
              })
              .catch((err) => {
                console.error('[useOpenClaw] Handoff execution threw:', err);
                const { addMessage: addMsg } = useAgentStore.getState();
                addMsg(targetAgent, {
                  role: 'system',
                  content: `Handoff failed unexpectedly: ${String(err)}. The task was not transferred.`,
                });
              });
          }
        }

        if (payload.state === 'error' || payload.state === 'aborted') {
          const errorText = payload.errorMessage || 'Response was ' + payload.state;
          updateLastMessage(targetAgent, { content: errorText, reasoning: '' });
          setLoading(false);
          streamBufferRef.current = '';
          thinkingBufferRef.current = '';
          activeRunRef.current = null;
          if (staleRunTimerRef.current) {
            clearTimeout(staleRunTimerRef.current);
            staleRunTimerRef.current = null;
          }
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
    const version = getSessionVersion(targetAgent);
    const sessionKey = sessionKeyForAgent(targetAgent, version);
    
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
    thinkingBufferRef.current = '';

    // ── Semantic Recall: enrich message with relevant past context ──────
    let enrichedMessage = message;
    try {
      const [recalled, entityContext] = await Promise.all([
        recallContextForAgent(targetAgent, message, {
          maxMemories: 5,
          includePatterns: true,
          includeRecentSummary: true,
        }),
        recallEntityContext(targetAgent, message, { maxResults: 5 }),
      ]);
      if (recalled.formattedContext) {
        enrichedMessage = `${message}\n\n---\n<recalled_context>\n${recalled.formattedContext}\n</recalled_context>`;
      }
      if (entityContext) {
        enrichedMessage += `\n\n<entity_context>\n${entityContext}\n</entity_context>`;
      }
    } catch (err) {
      console.warn('[useOpenClaw] Semantic recall failed (non-blocking):', err);
    }

    // ── Handoff instructions: teach agent about available team members ──
    const agentRoster = buildAgentRoster();
    if (agentRoster) {
      enrichedMessage += `\n\n<handoff_instructions>\n${HANDOFF_SYSTEM_PROMPT}\n\nAvailable agents:\n${agentRoster}\n</handoff_instructions>`;
    }

    // ── Project context: inject project docs + skills + team ──────────
    const activeProjectId = useProjectsStore.getState().activeProjectForChat;
    if (activeProjectId) {
      try {
        const projectInjection = await buildProjectContextInjection(activeProjectId, targetAgent);
        if (projectInjection) {
          enrichedMessage += `\n\n${projectInjection}`;
        }
      } catch (err) {
        console.warn('[useOpenClaw] Project context injection failed (non-blocking):', err);
      }
    }

    // ── Mission context: inject if this is the first message in a "chat about it" session
    const pendingMissionContext = useAgentStore.getState().pendingMissionContextByAgent[targetAgent];
    if (pendingMissionContext) {
      enrichedMessage += `\n\n${pendingMissionContext}`;
      useAgentStore.getState().clearPendingMissionContext(targetAgent);
    }

    // ── Auto-embed user message (fire-and-forget) ──────────────────────
    const userMsgId = `user-${idempotencyKey}`;
    storeEmbedding('chat_message', userMsgId, targetAgent, message).catch(() => {});

    // Pre-set the active run with the idempotency key so we can match events
    // The actual runId from the ack will replace this
    activeRunRef.current = { agentId: targetAgent, runId: idempotencyKey };

    // Safety net: if no final/error event arrives within STALE_RUN_TIMEOUT_MS,
    // force-reset isLoading so the chat input doesn't stay permanently disabled.
    if (staleRunTimerRef.current) clearTimeout(staleRunTimerRef.current);
    staleRunTimerRef.current = setTimeout(() => {
      if (activeRunRef.current?.runId === idempotencyKey || activeRunRef.current?.agentId === targetAgent) {
        console.warn('[useOpenClaw] Stale run timeout — resetting loading state');
        setLoading(false);
        activeRunRef.current = null;
        streamBufferRef.current = '';
        thinkingBufferRef.current = '';
      }
      staleRunTimerRef.current = null;
    }, STALE_RUN_TIMEOUT_MS);

    try {
      const result = await openclawClient.send('chat.send', {
        sessionKey,
        message: enrichedMessage,
        deliver: false,
        idempotencyKey,
      }) as any;
      
      console.log('[useOpenClaw] chat.send ack:', result);
      
      // Update with the actual runId from the server.
      // Re-arm the stale-run timer from this point since we now have the real runId.
      const serverRunId = result?.runId || idempotencyKey;
      activeRunRef.current = { agentId: targetAgent, runId: serverRunId };
      console.log('[useOpenClaw] Tracking runId:', serverRunId, 'for agent:', targetAgent);

      if (staleRunTimerRef.current) clearTimeout(staleRunTimerRef.current);
      staleRunTimerRef.current = setTimeout(() => {
        if (activeRunRef.current?.runId === serverRunId) {
          console.warn('[useOpenClaw] Stale run timeout — resetting loading state');
          setLoading(false);
          activeRunRef.current = null;
          streamBufferRef.current = '';
          thinkingBufferRef.current = '';
        }
        staleRunTimerRef.current = null;
      }, STALE_RUN_TIMEOUT_MS);
    } catch (err) {
      setLoading(false);
      activeRunRef.current = null;
      if (staleRunTimerRef.current) {
        clearTimeout(staleRunTimerRef.current);
        staleRunTimerRef.current = null;
      }
      updateLastMessage(targetAgent, { content: 'Error: ' + String(err), reasoning: '' });
    }
  }, [activeAgentId, addMessage, getSessionVersion, setLoading, updateLastMessage]);

  // Keep sendMessageRef in sync so the onMessage handler can trigger handoff sends
  sendMessageRef.current = sendMessage;

  const spawnSubAgent = useCallback(async (runId: string, agentId: string, task: string): Promise<void> => {
    subAgentRunsRef.current.set(runId, { agentId });
    subAgentRunAliasesRef.current.set(runId, runId);
    emitSubAgentEvent({ runId, agentId, state: 'queued' });

    try {
      const version = getSessionVersion(agentId);
      const result = await openclawClient.send('chat.send', {
        sessionKey: sessionKeyForAgent(agentId, version),
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
  }, [cleanupSubAgentRun, emitSubAgentEvent, getSessionVersion]);

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
