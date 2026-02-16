// ─── Boardroom Orchestrator V2 ───────────────────────────────────────────────
// Smart routing with turn awareness, auto-start, and WhatsApp notifications

import { useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';
import { useBoardroomStore } from '../stores/boardroom';
import { useBoardroom } from './useBoardroom';
import { createNotificationDirect } from './useNotifications';
import { extractText, extractReasoning, mergeDeltaBuffer, buildAgentPrompt } from '../lib/boardroomUtils';
import {
  selectNextSpeaker,
  selectNextSpeakerRoundRobin,
  determineSessionPhase,
  initializeTurnTracking,
  updateTurnTracking,
  shouldGenerateSummary,
  buildSummaryPrompt,
} from '../lib/boardroomSmartRouting';
import type { BoardroomSessionMetadata, RoutingMode, SessionSummary } from '../types/boardroom';

// ─── WhatsApp Notification Helper ────────────────────────────────────────────

async function sendWhatsAppNotification(message: string): Promise<void> {
  try {
    // Send via OpenClaw message tool
    await openclawClient.send('message.send', {
      action: 'send',
      channel: 'whatsapp',
      message,
      bestEffort: true,
    });
  } catch (err) {
    console.error('[Boardroom] WhatsApp notification failed:', err);
    // Don't throw - notifications are best-effort
  }
}

// ─── Summary Generation ──────────────────────────────────────────────────────

async function generateSessionSummary(
  sessionId: string,
  session: any,
  conversationHistory: any[],
  agentProfiles: Record<string, any>
): Promise<SessionSummary | null> {
  try {
    const prompt = buildSummaryPrompt(session, conversationHistory, agentProfiles);
    
    await openclawClient.send('chat.send', {
      sessionKey: `boardroom:${sessionId}:summary`,
      message: prompt,
      deliver: false,
      idempotencyKey: `summary-${sessionId}-${Date.now()}`,
    });
    
    // Wait for response (simplified - in production you'd use the event stream)
    // For now, return a placeholder
    const summary: SessionSummary = {
      decisions: [],
      action_items: [],
      unresolved: [],
      generated_at: new Date().toISOString(),
    };
    
    return summary;
  } catch (err) {
    console.error('[Boardroom] Summary generation failed:', err);
    return null;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBoardroomOrchestratorV2() {
  const store = useBoardroomStore();
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const { addMessageToSession, endSession, updateSessionMetadata } = useBoardroom();
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

      const metadata = (session.metadata || {}) as BoardroomSessionMetadata;
      const routingMode: RoutingMode = metadata.routing_mode || 'smart';
      const notifyWhatsApp = metadata.notify_whatsapp ?? true;

      // Initialize turn tracking if using smart routing
      if (routingMode === 'smart' && !metadata.turn_tracking) {
        metadata.turn_tracking = initializeTurnTracking(session.participant_agent_ids);
      }

      // WhatsApp notification: session starting
      if (notifyWhatsApp) {
        const participantCount = session.participant_agent_ids.length;
        const agenda = metadata.agenda?.length
          ? `\n\nAgenda:\n${metadata.agenda.map(item => `• ${item}`).join('\n')}`
          : '';
        
        await sendWhatsAppNotification(
          `🏛️ Boardroom starting: ${session.title}\n` +
          `${participantCount} agents, ${session.session_type} session, ${session.max_turns} turns.${agenda}`
        );
      }

      // System notification
      createNotificationDirect(
        'system',
        `Boardroom session starting: ${session.title}`,
        `${session.participant_agent_ids.length} agents in a ${session.session_type} session (${routingMode} routing)`,
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

      // Main orchestration loop
      for (let i = 0; i < session.max_turns - session.turn_count; i++) {
        if (cancelRef.current) break;

        const turnNumber = currentTurn + i + 1;
        
        // Determine current phase
        const phase = determineSessionPhase(turnNumber, session.max_turns);
        metadata.current_phase = phase;

        // Select next speaker based on routing mode
        let agentId: string;
        let routingReasoning = '';

        if (routingMode === 'smart') {
          const selection = selectNextSpeaker({
            session,
            conversationHistory,
            currentTurn: turnNumber,
            agentProfiles,
          });
          agentId = selection.agentId;
          routingReasoning = selection.reasoning;
          
          // Store routing decision in metadata
          metadata.last_routing_decision = {
            turn: turnNumber,
            chosen_agent: agentId,
            reasoning: routingReasoning,
            timestamp: new Date().toISOString(),
          };
        } else {
          // Round-robin fallback
          agentId = selectNextSpeakerRoundRobin(participants, turnNumber);
          routingReasoning = 'Round-robin selection';
        }

        if (!agentId) {
          console.error('[Boardroom] No agent selected for turn', turnNumber);
          break;
        }

        // Set speaking agent
        store.setCurrentSpeakingAgentId(agentId);
        store.setStreamingContent('');

        // Build prompt with phase awareness
        const prompt = buildAgentPrompt({
          agentId,
          session: { ...session, metadata },
          conversationHistory,
          turnNumber,
          agentProfiles,
        });

        // Session key for OpenClaw
        const sessionKey = `boardroom:${sessionId}:${agentId}:turn${turnNumber}`;
        const idempotencyKey = `br-${sessionId}-${turnNumber}-${Date.now()}`;

        try {
          // Set up streaming listener for this turn
          let streamBuffer = '';
          let reasoningBuffer = '';
          let resolved = false;
          const acceptedRunIds = new Set<string>([idempotencyKey]);

          const turnPromise = new Promise<{ text: string; reasoning: string }>((resolve, reject) => {
            const unsub = openclawClient.onMessage((msg: OpenClawMessage) => {
              if (msg.type !== 'event' || msg.event !== 'chat') return;
              const payload = msg.payload as any;
              const eventRunId = payload.runId as string | undefined;

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

          // Send the chat request
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

          // Update turn tracking
          if (routingMode === 'smart' && metadata.turn_tracking) {
            metadata.turn_tracking = updateTurnTracking(
              metadata.turn_tracking,
              agentId,
              turnNumber
            );
          }

          // Persist metadata updates
          await updateSessionMetadata(sessionId, metadata);

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

      // Generate summary
      if (!cancelRef.current && shouldGenerateSummary(session, session.max_turns)) {
        const summary = await generateSessionSummary(
          sessionId,
          session,
          conversationHistory,
          agentProfiles
        );
        
        if (summary) {
          metadata.session_summary = summary;
          await updateSessionMetadata(sessionId, metadata);
        }

        // WhatsApp notification: session ended with summary
        if (notifyWhatsApp && summary) {
          const summaryText = [
            `🏛️ Boardroom ended: ${session.title}`,
            '',
            '📋 Summary:',
            summary.decisions.length > 0 ? `\n✅ Decisions:\n${summary.decisions.map(d => `• ${d}`).join('\n')}` : '',
            summary.action_items.length > 0 ? `\n📌 Action Items:\n${summary.action_items.map(a => `• ${a.task}${a.owner ? ` (${a.owner})` : ''}`).join('\n')}` : '',
            summary.unresolved.length > 0 ? `\n❓ Unresolved:\n${summary.unresolved.map(u => `• ${u}`).join('\n')}` : '',
          ].filter(Boolean).join('\n');

          await sendWhatsAppNotification(summaryText);
        }
      }

      // Auto-close session
      if (!cancelRef.current) {
        await endSession(sessionId);

        // System notification
        createNotificationDirect(
          'system',
          `Boardroom session ended: ${session.title}`,
          `Completed ${session.max_turns} turns`,
        ).catch(() => {});
      }
    },
    [store, agentProfiles, addMessageToSession, endSession, updateSessionMetadata]
  );

  return {
    runSession,
    stopSession,
    isOrchestrating: store.isOrchestrating,
  };
}
