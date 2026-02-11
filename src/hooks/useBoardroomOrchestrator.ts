import { useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';
import { useBoardroomStore } from '../stores/boardroom';
import { useBoardroom } from './useBoardroom';
import { createNotificationDirect } from './useNotifications';
import { getSessionPreset, type BoardroomMessage, type BoardroomSession, type BoardroomSessionMetadata } from '../types/boardroom';

// ─── Utility functions (extracted from useOpenClaw patterns) ──────────────

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
  if (typeof message.text === 'string') return message.text;
  return '';
}

function extractReasoning(message: any): string {
  if (!message) return '';
  if (typeof message.reasoning === 'string') return message.reasoning;
  if (typeof message.reasoning_content === 'string') return message.reasoning_content;
  if (typeof message.thinking === 'string') return message.thinking;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c && (c.type === 'thinking' || c.type === 'reasoning'))
      .map((c: any) => c.thinking || c.text || c.reasoning || '')
      .join('');
  }
  return '';
}

function mergeDeltaBuffer(previous: string, incoming: string): string {
  if (!incoming) return previous;
  if (!previous) return incoming;

  // Cumulative: incoming is the full response so far (supersedes previous)
  if (incoming.startsWith(previous)) return incoming;
  // Stale/duplicate: previous already contains incoming
  if (previous.startsWith(incoming)) return previous;

  // Heuristic: if incoming is nearly as long or longer than previous,
  // the gateway is in cumulative mode but minor formatting differences
  // caused the exact startsWith check to fail. Use the longer text.
  if (incoming.length > previous.length * 0.8) {
    return incoming;
  }

  // Append mode: gateway sends just the new token/chunk
  return previous + incoming;
}

// ─── Prompt building ──────────────────────────────────────────────────────

function buildAgentPrompt(
  agentId: string,
  session: BoardroomSession,
  conversationHistory: BoardroomMessage[],
  turnNumber: number,
  agentProfiles: Record<string, any>
): string {
  const profile = agentProfiles[agentId];
  if (!profile) return 'Respond thoughtfully.';

  const soul = profile.soul;
  const preset = getSessionPreset(session.session_type);

  // Build participant list
  const participantList = session.participant_agent_ids
    .map((id: string) => {
      const p = agentProfiles[id];
      return p ? `${p.emoji} ${p.name} (${p.role})` : id;
    })
    .join(', ');

  // Build conversation history
  const historyLines = conversationHistory.map((msg) => {
    const a = agentProfiles[msg.agent_id];
    const name = a ? `${a.emoji} ${a.name}` : msg.agent_id;
    return `[Turn ${msg.turn_number}] ${name}: ${msg.content}`;
  });

  const parts: string[] = [];

  // SOUL section
  parts.push(`=== YOUR IDENTITY ===`);
  parts.push(`Name: ${profile.name}`);
  parts.push(`Role: ${profile.role}`);
  parts.push(`Persona: ${profile.persona}`);
  parts.push(`Origin: ${soul.origin}`);
  if (soul.philosophy.length > 0) {
    parts.push(`Philosophy: ${soul.philosophy.join('; ')}`);
  }
  parts.push(`Communication: ${soul.communicationStyle.tone} (${soul.communicationStyle.formality}, ${soul.communicationStyle.verbosity})`);
  if (soul.communicationStyle.quirks.length > 0) {
    parts.push(`Quirks: ${soul.communicationStyle.quirks.join('; ')}`);
  }
  if (soul.neverDos.length > 0) {
    parts.push(`Hard bans: ${soul.neverDos.join('; ')}`);
  }

  // Session context
  parts.push('');
  parts.push(`=== SESSION CONTEXT ===`);
  parts.push(`Title: ${session.title}`);
  parts.push(`Type: ${preset.label}`);
  if (session.topic) parts.push(`Topic: ${session.topic}`);
  parts.push(`Participants: ${participantList}`);
  parts.push(`Turn ${turnNumber} of ${session.max_turns}`);

  // Entity references
  const metadata = session.metadata as BoardroomSessionMetadata | undefined;
  if (metadata?.entity_references?.length) {
    parts.push('');
    parts.push('=== REFERENCED ENTITIES ===');
    for (const ref of metadata.entity_references) {
      parts.push(`- ${ref.emoji || ''} [${ref.type}] ${ref.label}`);
    }
  }

  // Attachments
  if (metadata?.attachments?.length) {
    parts.push('');
    parts.push('=== ATTACHED FILES ===');
    for (const att of metadata.attachments) {
      parts.push(`- ${att.name} (${att.type})`);
    }
  }

  // Preparation findings
  if (metadata?.preparation?.results?.length) {
    const completedResults = metadata.preparation.results.filter((r) => r.status === 'completed');
    if (completedResults.length > 0) {
      parts.push('');
      parts.push('=== PREPARATION FINDINGS ===');
      for (const result of completedResults) {
        const prepAgent = agentProfiles[result.agent_id];
        const agentLabel = prepAgent ? `${prepAgent.emoji} ${prepAgent.name}` : result.agent_id;
        parts.push(`--- ${agentLabel} ---`);
        const truncatedText = result.text.length > 2000
          ? result.text.slice(0, 2000) + '... (truncated)'
          : result.text;
        parts.push(truncatedText);
      }
      parts.push('Use these preparation findings as background context for the discussion.');
    }
  }

  // Conversation history
  if (historyLines.length > 0) {
    parts.push('');
    parts.push(`=== CONVERSATION SO FAR ===`);
    parts.push(historyLines.join('\n'));
  }

  // Instructions
  parts.push('');
  parts.push(`=== INSTRUCTIONS ===`);
  parts.push(preset.guidance);
  parts.push('Stay fully in character. Respond to what others have said. Be concise but substantive.');
  if (historyLines.length === 0) {
    parts.push('You are opening the conversation. Set the tone.');
  }

  return parts.join('\n');
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useBoardroomOrchestrator() {
  const store = useBoardroomStore();
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const { addMessageToSession, endSession } = useBoardroom();
  const cancelRef = useRef(false);
  const messageListenerRef = useRef<(() => void) | null>(null);

  const stopSession = useCallback(() => {
    cancelRef.current = true;
    store.setIsOrchestrating(false);
    store.setCurrentSpeakingAgentId(null);
    store.setStreamingContent('');
    if (messageListenerRef.current) {
      messageListenerRef.current();
      messageListenerRef.current = null;
    }
  }, [store]);

  const runSession = useCallback(
    async (sessionId: string) => {
      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session) return;

      cancelRef.current = false;
      store.setActiveSessionId(sessionId);
      store.setIsOrchestrating(true);

      // Notify session starting
      createNotificationDirect(
        'system',
        `Boardroom session starting: ${session.title}`,
        `${session.participant_agent_ids.length} agents in a ${session.session_type} session`,
      ).catch(() => {});

      const participants = session.participant_agent_ids;
      if (participants.length === 0) {
        store.setIsOrchestrating(false);
        return;
      }

      // Get existing messages for this session
      const existingMessages = store.messages[sessionId] || [];
      const conversationHistory = [...existingMessages];
      let currentTurn = session.turn_count;

      // Round-robin loop
      for (let i = 0; i < session.max_turns - session.turn_count; i++) {
        if (cancelRef.current) break;

        const agentIndex = (currentTurn + i) % participants.length;
        const agentId = participants[agentIndex];
        const turnNumber = currentTurn + i + 1;

        // Set speaking agent
        store.setCurrentSpeakingAgentId(agentId);
        store.setStreamingContent('');

        // Build prompt
        const prompt = buildAgentPrompt(
          agentId,
          session,
          conversationHistory,
          turnNumber,
          agentProfiles
        );

        // Session key for OpenClaw
        const sessionKey = `boardroom:${sessionId}:${agentId}:turn${turnNumber}`;
        const idempotencyKey = `br-${sessionId}-${turnNumber}-${Date.now()}`;

        try {
          // Set up streaming listener for this turn
          let streamBuffer = '';
          let reasoningBuffer = '';
          let resolved = false;
          // Track accepted runIds: idempotencyKey is known upfront,
          // the server may also assign a different runId in the ack.
          const acceptedRunIds = new Set<string>([idempotencyKey]);

          const turnPromise = new Promise<{ text: string; reasoning: string }>((resolve, reject) => {
            const unsub = openclawClient.onMessage((msg: OpenClawMessage) => {
              if (msg.type !== 'event' || msg.event !== 'chat') return;
              const payload = msg.payload as any;
              const eventRunId = payload.runId as string | undefined;

              // Strict runId matching — ignore events from unrelated runs
              if (eventRunId && !acceptedRunIds.has(eventRunId)) return;

              if (payload.state === 'delta') {
                const text = extractText(payload.message);
                const reasoning = extractReasoning(payload.message);
                if (text) {
                  streamBuffer = mergeDeltaBuffer(streamBuffer, text);
                  store.setStreamingContent(streamBuffer);
                }
                if (reasoning) {
                  reasoningBuffer = mergeDeltaBuffer(reasoningBuffer, reasoning);
                }
              }

              if (payload.state === 'final') {
                const text = extractText(payload.message);
                const reasoning = extractReasoning(payload.message);
                const finalText = mergeDeltaBuffer(streamBuffer, text);
                const finalReasoning = mergeDeltaBuffer(reasoningBuffer, reasoning);
                resolved = true;
                unsub();
                resolve({ text: finalText, reasoning: finalReasoning });
              }

              if (payload.state === 'error' || payload.state === 'aborted') {
                resolved = true;
                unsub();
                reject(new Error(payload.errorMessage || `Turn ${payload.state}`));
              }
            });

            messageListenerRef.current = unsub;

            // Timeout safety
            setTimeout(() => {
              if (!resolved) {
                unsub();
                if (streamBuffer) {
                  resolve({ text: streamBuffer, reasoning: reasoningBuffer });
                } else {
                  reject(new Error('Turn timeout'));
                }
              }
            }, 120_000); // 2 min timeout per turn
          });

          // Send the chat request — register server runId if different
          const ack = await openclawClient.send('chat.send', {
            sessionKey,
            message: prompt,
            deliver: false,
            idempotencyKey,
          }) as { runId?: string } | undefined;

          if (ack?.runId && ack.runId !== idempotencyKey) {
            acceptedRunIds.add(ack.runId);
          }

          // Wait for streaming to complete
          const { text, reasoning } = await turnPromise;

          if (cancelRef.current) break;

          // Persist message to Supabase
          const saved = await addMessageToSession({
            session_id: sessionId,
            agent_id: agentId,
            content: text,
            reasoning: reasoning || undefined,
            turn_number: turnNumber,
          });

          if (saved) {
            conversationHistory.push(saved);
          }

          store.setStreamingContent('');
          store.setCurrentSpeakingAgentId(null);

          // Brief delay between turns for readability
          if (i < session.max_turns - session.turn_count - 1 && !cancelRef.current) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        } catch (err) {
          console.error('[BoardroomOrchestrator] Turn error:', err);
          store.setStreamingContent('');
          store.setCurrentSpeakingAgentId(null);
          // Continue to next turn even on error
        }
      }

      // Session complete
      store.setIsOrchestrating(false);
      store.setCurrentSpeakingAgentId(null);
      store.setStreamingContent('');
      store.setActiveSessionId(null);

      // Auto-close session when max turns reached
      if (!cancelRef.current) {
        await endSession(sessionId);

        // Notify session ended
        createNotificationDirect(
          'system',
          `Boardroom session ended: ${session.title}`,
          `Completed ${session.max_turns} turns`,
        ).catch(() => {});
      }
    },
    [store, agentProfiles, addMessageToSession, endSession]
  );

  return {
    runSession,
    stopSession,
    isOrchestrating: store.isOrchestrating,
  };
}
