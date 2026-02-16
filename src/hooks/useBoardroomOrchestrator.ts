import { useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';
import { useBoardroomStore } from '../stores/boardroom';
import { useBoardroom } from './useBoardroom';
import { useBoardroomResolution } from './useBoardroomResolution';
import { createNotificationDirect } from './useNotifications';
import { extractText, extractReasoning, mergeDeltaBuffer, buildAgentPrompt } from '../lib/boardroomUtils';
import {
  initializeTurnTracking,
  updateTurnTracking,
  selectNextSpeaker,
  markAgentMentioned,
  buildSummaryPrompt,
} from '../lib/boardroomSmartRouting';
import { getDefaultResolutionMode } from '../lib/boardroomResolution';
import { isUserParticipant, shouldWaitForUser, getUserTurnTimeout } from '../lib/boardroomUserParticipation';
import type { BoardroomSessionMetadata, TurnTracking, SessionSummary } from '../types/boardroom';

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useBoardroomOrchestrator() {
  // Subscribe only to the specific slices needed for return values.
  // Callbacks access the store via getState() so they remain stable.
  const isOrchestrating = useBoardroomStore((s) => s.isOrchestrating);
  const isPaused = useBoardroomStore((s) => s.isPaused);
  const waitingForUser = useBoardroomStore((s) => s.waitingForUser);
  const userRaisedHand = useBoardroomStore((s) => s.userRaisedHand);

  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const { addMessageToSession, endSession } = useBoardroom();
  const cancelRef = useRef(false);
  const messageListenerRef = useRef<(() => void) | null>(null);

  const stopSession = useCallback(() => {
    cancelRef.current = true;
    const s = useBoardroomStore.getState();
    s.setIsOrchestrating(false);
    s.setPaused(false);
    s.setWaitingForUser(false);
    s.setCurrentSpeakingAgentId(null);
    s.setStreamingContent('');
    if (messageListenerRef.current) {
      messageListenerRef.current();
      messageListenerRef.current = null;
    }
  }, []);

  const pauseSession = useCallback(() => {
    useBoardroomStore.getState().setPaused(true);
  }, []);

  const resumeSession = useCallback(() => {
    useBoardroomStore.getState().setPaused(false);
  }, []);

  const { generateResolutionPackage, saveResolutionPackage, executeResolutionPackage } = useBoardroomResolution();

  const runSession = useCallback(
    async (sessionId: string) => {
      const store = useBoardroomStore.getState();
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

      // Send WhatsApp notification for session start
      const sessionMetadata = session.metadata as BoardroomSessionMetadata;
      const notifyWhatsApp = sessionMetadata?.notify_whatsapp !== false;
      if (notifyWhatsApp) {
        try {
          const agendaText = sessionMetadata?.agenda?.length
            ? `\nAgenda: ${sessionMetadata.agenda.join(', ')}`
            : '';

          const startMessage = `🏛️ Boardroom starting: ${session.title} — ${session.participant_agent_ids.length} agents, ${session.session_type} session, ${session.max_turns} turns.${agendaText}`;

          await openclawClient.send('message.send', {
            channel: 'whatsapp',
            message: startMessage,
          });
        } catch (err) {
          console.error('[BoardroomOrchestrator] Failed to send WhatsApp start notification:', err);
        }
      }

      const participants = session.participant_agent_ids;
      if (participants.length === 0) {
        useBoardroomStore.getState().setIsOrchestrating(false);
        return;
      }

      // Get existing messages for this session
      const existingMessages = useBoardroomStore.getState().messages[sessionId] || [];
      const conversationHistory = [...existingMessages];
      let currentTurn = session.turn_count;

      // Initialize or restore turn tracking
      let turnTracking: TurnTracking[] = sessionMetadata?.turn_tracking || initializeTurnTracking(participants);

      // Smart routing with phase awareness
      for (let i = 0; i < session.max_turns - session.turn_count; i++) {
        if (cancelRef.current) break;

        // Check for pause
        while (useBoardroomStore.getState().isPaused && !cancelRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (cancelRef.current) break;

        const turnNumber = currentTurn + i + 1;

        // Select next speaker using smart routing or round-robin
        const currentAgentProfiles = useAgentStore.getState().agentProfiles;
        const selection = selectNextSpeaker({
          session,
          conversationHistory,
          currentTurn: currentTurn + i,
          agentProfiles: currentAgentProfiles,
        });
        let agentId = selection.agentId;

        // Override if user raised hand and smart routing is enabled
        if (useBoardroomStore.getState().userRaisedHand && sessionMetadata?.routing_mode === 'smart') {
          const userId = session.participant_agent_ids.find(isUserParticipant);
          if (userId) {
            agentId = userId;
            useBoardroomStore.getState().setUserRaisedHand(false);
          }
        }

        // Set speaking agent
        const s = useBoardroomStore.getState();
        s.setCurrentSpeakingAgentId(agentId);
        s.setStreamingContent('');

        // Check if this is the user's turn
        if (shouldWaitForUser(session, agentId)) {
          // Wait for user input
          useBoardroomStore.getState().setWaitingForUser(true);

          const userTimeout = getUserTurnTimeout(session);
          const userInputPromise = new Promise<{ text: string; reasoning: string }>((resolve, reject) => {
            const startTime = Date.now();

            // Poll for user message
            const checkForUserMessage = setInterval(() => {
              const messages = useBoardroomStore.getState().messages[sessionId] || [];
              const userMessage = messages.find(
                (msg) => msg.turn_number === turnNumber && msg.sender_type === 'user'
              );

              if (userMessage) {
                clearInterval(checkForUserMessage);
                useBoardroomStore.getState().setWaitingForUser(false);
                resolve({ text: userMessage.content, reasoning: '' });
              } else if (Date.now() - startTime > userTimeout) {
                clearInterval(checkForUserMessage);
                useBoardroomStore.getState().setWaitingForUser(false);
                reject(new Error('User turn timeout'));
              } else if (cancelRef.current) {
                clearInterval(checkForUserMessage);
                useBoardroomStore.getState().setWaitingForUser(false);
                reject(new Error('Session stopped'));
              }
            }, 500);
          });

          try {
            await userInputPromise;

            // User message already saved by UI, just add to conversation history
            const userMessage = (useBoardroomStore.getState().messages[sessionId] || []).find(
              (msg) => msg.turn_number === turnNumber && msg.sender_type === 'user'
            );

            if (userMessage) {
              conversationHistory.push(userMessage);

              // Update turn tracking
              turnTracking = updateTurnTracking(turnTracking, agentId, turnNumber);
            }
          } catch (err) {
            console.error('[BoardroomOrchestrator] User turn error:', err);
            // Continue to next turn if user times out or session is stopped
            if (cancelRef.current) break;
            continue;
          }

          // Brief delay before next turn
          if (i < session.max_turns - session.turn_count - 1 && !cancelRef.current) {
            await new Promise((r) => setTimeout(r, 1000));
          }

          continue; // Skip agent LLM call
        }

        // Build prompt
        const prompt = buildAgentPrompt({
          agentId,
          session,
          conversationHistory,
          turnNumber,
          agentProfiles: currentAgentProfiles,
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

              // Strict runId matching — ignore events from unrelated runs
              if (eventRunId && !acceptedRunIds.has(eventRunId)) return;

              if (payload.state === 'delta') {
                const text = extractText(payload.message);
                const reasoning = extractReasoning(payload.message);
                if (text) {
                  streamBuffer = mergeDeltaBuffer(streamBuffer, text);
                  useBoardroomStore.getState().setStreamingContent(streamBuffer);
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

          // Update turn tracking
          turnTracking = updateTurnTracking(turnTracking, agentId, turnNumber);

          // Detect and mark mentioned agents
          const textLower = text.toLowerCase();
          for (const pid of participants) {
            const profile = currentAgentProfiles[pid];
            if (profile?.name && textLower.includes(profile.name.toLowerCase())) {
              turnTracking = markAgentMentioned(turnTracking, pid, turnNumber);
            }
          }

          const s2 = useBoardroomStore.getState();
          s2.setStreamingContent('');
          s2.setCurrentSpeakingAgentId(null);

          // Brief delay between turns for readability
          if (i < session.max_turns - session.turn_count - 1 && !cancelRef.current) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        } catch (err) {
          console.error('[BoardroomOrchestrator] Turn error:', err);
          const s2 = useBoardroomStore.getState();
          s2.setStreamingContent('');
          s2.setCurrentSpeakingAgentId(null);
          // Continue to next turn even on error
        }
      }

      // Session complete
      const finalStore = useBoardroomStore.getState();
      finalStore.setIsOrchestrating(false);
      finalStore.setCurrentSpeakingAgentId(null);
      finalStore.setStreamingContent('');
      finalStore.setActiveSessionId(null);

      // Auto-close session when max turns reached
      if (!cancelRef.current) {
        // Generate session summary via streaming
        let sessionSummary: SessionSummary | null = null;
        try {
          const summaryPrompt = buildSummaryPrompt(session, conversationHistory, agentProfiles);
          const summarySessionKey = `boardroom:${sessionId}:summary`;
          const summaryIdempotencyKey = `br-${sessionId}-summary-${Date.now()}`;
          const summaryAcceptedRunIds = new Set<string>([summaryIdempotencyKey]);

          let summaryStreamBuffer = '';
          let summaryResolved = false;

          const summaryResponsePromise = new Promise<string>((resolve, reject) => {
            const unsub = openclawClient.onMessage((msg: OpenClawMessage) => {
              if (msg.type !== 'event' || msg.event !== 'chat') return;
              const payload = msg.payload as any;
              const eventRunId = payload.runId as string | undefined;
              if (eventRunId && !summaryAcceptedRunIds.has(eventRunId)) return;

              if (payload.state === 'delta') {
                const text = extractText(payload.message);
                if (text) summaryStreamBuffer = mergeDeltaBuffer(summaryStreamBuffer, text);
              }
              if (payload.state === 'final') {
                const text = extractText(payload.message);
                const finalText = mergeDeltaBuffer(summaryStreamBuffer, text);
                summaryResolved = true;
                unsub();
                resolve(finalText);
              }
              if (payload.state === 'error' || payload.state === 'aborted') {
                summaryResolved = true;
                unsub();
                reject(new Error(payload.errorMessage || 'Summary generation failed'));
              }
            });

            setTimeout(() => {
              if (!summaryResolved) {
                unsub();
                if (summaryStreamBuffer) resolve(summaryStreamBuffer);
                else reject(new Error('Summary generation timeout'));
              }
            }, 90_000);
          });

          const summaryAck = await openclawClient.send('chat.send', {
            sessionKey: summarySessionKey,
            message: summaryPrompt,
            deliver: false,
            idempotencyKey: summaryIdempotencyKey,
          }) as { runId?: string } | undefined;

          if (summaryAck?.runId && summaryAck.runId !== summaryIdempotencyKey) {
            summaryAcceptedRunIds.add(summaryAck.runId);
          }

          const summaryResponse = await summaryResponsePromise;

          // Parse JSON from the response (may be wrapped in ```json ... ``` fences)
          let parsedSummary: { decisions?: string[]; action_items?: any[]; unresolved?: string[] } = {
            decisions: [],
            action_items: [],
            unresolved: [],
          };
          try {
            const jsonMatch = summaryResponse.match(/```json\s*([\s\S]*?)```/);
            const jsonStr = jsonMatch ? jsonMatch[1].trim() : summaryResponse.trim();
            parsedSummary = JSON.parse(jsonStr);
          } catch (parseErr) {
            console.warn('[BoardroomOrchestrator] Failed to parse summary JSON, using empty:', parseErr);
          }

          sessionSummary = {
            decisions: parsedSummary.decisions || [],
            action_items: parsedSummary.action_items || [],
            unresolved: parsedSummary.unresolved || [],
            generated_at: new Date().toISOString(),
          };
        } catch (err) {
          console.error('[BoardroomOrchestrator] Failed to generate summary:', err);
        }

        // Generate resolution package if applicable
        let resolutionPackage = null;
        const resolutionMode = sessionMetadata?.resolution_mode || getDefaultResolutionMode(session.session_type);

        if (resolutionMode !== 'none' && sessionSummary) {
          try {
            resolutionPackage = await generateResolutionPackage(
              session,
              conversationHistory,
              sessionSummary,
              agentProfiles
            );

            if (resolutionPackage) {
              await saveResolutionPackage(sessionId, resolutionPackage);

              // Auto-execute if mode is 'auto'
              if (resolutionMode === 'auto') {
                await executeResolutionPackage(sessionId);
              }
            }
          } catch (err) {
            console.error('[BoardroomOrchestrator] Failed to generate resolution package:', err);
          }
        }

        // Update session metadata with final turn tracking and summary
        const updatedMetadata: BoardroomSessionMetadata = {
          ...sessionMetadata,
          turn_tracking: turnTracking,
          session_summary: sessionSummary || undefined,
          current_phase: 'wrap-up',
          resolution_mode: resolutionMode,
        };

        await endSession(sessionId, updatedMetadata);

        // Send WhatsApp notification if enabled (recheck from session metadata)
        if (notifyWhatsApp && sessionSummary) {
          try {
            const summaryText = [
              `🏛️ Boardroom ended: ${session.title}`,
              '',
              sessionSummary.decisions.length > 0
                ? `Decisions: ${sessionSummary.decisions.join('; ')}`
                : null,
              sessionSummary.action_items.length > 0
                ? `Action Items: ${sessionSummary.action_items.map(a => `${a.task}${a.owner ? ` (${a.owner})` : ''}`).join('; ')}`
                : null,
              sessionSummary.unresolved.length > 0
                ? `Unresolved: ${sessionSummary.unresolved.join('; ')}`
                : null,
            ].filter(Boolean).join('\n');

            await openclawClient.send('message.send', {
              channel: 'whatsapp',
              message: summaryText,
            });
          } catch (err) {
            console.error('[BoardroomOrchestrator] Failed to send WhatsApp summary:', err);
          }
        }

        // Notify session ended
        createNotificationDirect(
          'system',
          `Boardroom session ended: ${session.title}`,
          `Completed ${session.max_turns} turns`,
        ).catch(() => {});
      }
    },
    [agentProfiles, addMessageToSession, endSession, generateResolutionPackage, saveResolutionPackage, executeResolutionPackage]
  );

  return {
    runSession,
    stopSession,
    pauseSession,
    resumeSession,
    isOrchestrating,
    isPaused,
    waitingForUser,
    userRaisedHand,
  };
}
