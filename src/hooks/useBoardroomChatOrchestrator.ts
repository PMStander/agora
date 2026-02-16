// ─── Boardroom Chat Orchestrator ─────────────────────────────────────────────
// User-driven chat mode for project group conversations.
// Unlike the round-robin orchestrator, the user initiates each exchange.
// Supports @mentions for directed responses and smart routing when no mention.

import { useCallback, useEffect, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';
import { useBoardroomStore } from '../stores/boardroom';
import { useBoardroom } from './useBoardroom';
import { buildProjectContextInjection } from '../lib/projectContextBuilder';
import { extractText, extractReasoning, mergeDeltaBuffer, buildAgentPrompt } from '../lib/boardroomUtils';
import type { BoardroomSession, MessageMention } from '../types/boardroom';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatSendOptions {
  sessionId: string;
  content: string;
  mentions: MessageMention[];
}

// ─── Entity Context ──────────────────────────────────────────────────────────

function buildEntityContextBlock(mentions: MessageMention[]): string {
  const entityMentions = mentions.filter((m) => m.type === 'entity');
  if (entityMentions.length === 0) return '';

  const lines = entityMentions.map(
    (m) => `- [${m.entity_type || 'unknown'}] ${m.display} (id: ${m.id})`
  );

  return `=== REFERENCED ENTITIES (from message) ===\n${lines.join('\n')}`;
}

// ─── Smart Router ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','as','is','was','are','been','have','has','had','do','does','did',
  'will','would','should','could','can','may','might','i','you','he','she',
  'it','we','they','this','that','these','those','what','who','when','where',
  'why','how','not','no','yes','so','if','then','than','also','just','about',
  'up','out','all','some','any','each','every','into','over','after','before',
]);

function extractKeywords(content: string): string[] {
  return content
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function buildAgentCorpus(profile: any): string {
  const parts: string[] = [];
  if (profile.name) parts.push(profile.name);
  if (profile.role) parts.push(profile.role);
  if (profile.persona) parts.push(profile.persona);
  if (Array.isArray(profile.skills)) {
    parts.push(...profile.skills.filter((s: any) => typeof s === 'string'));
  }
  if (Array.isArray(profile.domains)) {
    parts.push(...profile.domains.filter((d: any) => typeof d === 'string'));
  }
  if (profile.soul?.origin) parts.push(profile.soul.origin);
  return parts.join(' ').toLowerCase();
}

function scoreAgentRelevance(keywords: string[], corpus: string, role: string): number {
  let score = 0;
  const roleLower = role.toLowerCase();
  for (const kw of keywords) {
    if (roleLower.includes(kw)) score += 10;
    else if (corpus.includes(kw)) score += 3;
  }
  return score;
}

function determineRespondents(
  session: BoardroomSession,
  mentions: MessageMention[],
  agentProfiles: Record<string, any>,
  messageContent?: string
): string[] {
  const agentMentions = mentions.filter((m) => m.type === 'agent');

  // Explicit @all or @team → all participants
  if (agentMentions.some((m) => m.id === '__all__' || m.id === '__team__')) {
    return [...session.participant_agent_ids];
  }

  // Specific agent @mentions → only those agents
  if (agentMentions.length > 0) {
    return agentMentions
      .map((m) => m.id)
      .filter((id) => session.participant_agent_ids.includes(id));
  }

  // No participants → nothing to do
  if (session.participant_agent_ids.length === 0) return [];

  // Short or missing messages → all participants respond
  const keywords = messageContent ? extractKeywords(messageContent) : [];
  if (keywords.length < 4) {
    return [...session.participant_agent_ids];
  }

  // Score each participant by keyword match against their profile
  const scores = session.participant_agent_ids.map((agentId) => {
    const profile = agentProfiles[agentId];
    if (!profile) return { agentId, score: 0 };
    const corpus = buildAgentCorpus(profile);
    return { agentId, score: scoreAgentRelevance(keywords, corpus, profile.role || '') };
  });

  scores.sort((a, b) => b.score - a.score);
  const topScore = scores[0].score;

  // If no agent scored meaningfully, respond with all
  if (topScore < 3) {
    return [...session.participant_agent_ids];
  }

  // Return agents within 70% of top score, capped at 3
  const threshold = topScore * 0.7;
  return scores
    .filter((s) => s.score >= threshold)
    .slice(0, 3)
    .map((s) => s.agentId);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBoardroomChatOrchestrator() {
  // Subscribe only to the specific slices needed for return values.
  // Callbacks access the store via getState() so they remain stable.
  const isChatSending = useBoardroomStore((s) => s.isChatSending);
  const chatStreamingByAgent = useBoardroomStore((s) => s.chatStreamingByAgent);
  const chatRespondingAgents = useBoardroomStore((s) => s.chatRespondingAgents);

  const { addMessageToSession } = useBoardroom();
  const cancelRef = useRef(false);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  // Cleanup listener on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }
    };
  }, []);

  const cancelChat = useCallback(() => {
    cancelRef.current = true;
    const s = useBoardroomStore.getState();
    s.setIsChatSending(false);
    s.setChatRespondingAgents([]);
    s.setCurrentSpeakingAgentId(null);
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
      listenerCleanupRef.current = null;
    }
    // Clear all agent streaming buffers
    const agents = Object.keys(s.chatStreamingByAgent);
    const reasoningAgents = Object.keys(s.chatStreamingReasoningByAgent);
    for (const agentId of agents) {
      s.clearChatStreamingForAgent(agentId);
    }
    for (const agentId of reasoningAgents) {
      s.clearChatStreamingReasoningForAgent(agentId);
    }
  }, []);

  const sendChatMessage = useCallback(
    async ({ sessionId, content, mentions }: ChatSendOptions) => {
      const store = useBoardroomStore.getState();

      // Guard against concurrent calls
      if (store.isChatSending) return;

      const session = store.sessions.find((s) => s.id === sessionId);
      if (!session || !content.trim()) return;

      cancelRef.current = false;
      store.setIsChatSending(true);

      // 1. Get current turn count and increment
      const existingMessages = store.messages[sessionId] || [];
      const nextTurn = existingMessages.length + 1;

      // 2. Persist user message to Supabase
      const userMessage = await addMessageToSession({
        session_id: sessionId,
        agent_id: 'user',
        content: content.trim(),
        turn_number: nextTurn,
        sender_type: 'user',
        mentions,
      });

      if (!userMessage) {
        useBoardroomStore.getState().setIsChatSending(false);
        return;
      }

      // 3. Determine which agents should respond
      const currentProfiles = useAgentStore.getState().agentProfiles;
      const respondents = determineRespondents(session, mentions, currentProfiles, content);
      if (respondents.length === 0) {
        // Add system message so the user knows why nothing happened
        await addMessageToSession({
          session_id: sessionId,
          agent_id: 'system',
          content: 'No agents are available to respond. Add agents to your project team in the Setup tab.',
          turn_number: nextTurn + 1,
          sender_type: 'system',
          mentions: [],
        });
        useBoardroomStore.getState().setIsChatSending(false);
        return;
      }

      useBoardroomStore.getState().setChatRespondingAgents(respondents);

      // 4. Build conversation history (last 20 messages for context window management)
      const allMessages = [...existingMessages, userMessage];
      const recentHistory = allMessages.slice(-20);

      // 5. Build project context once (if project-scoped)
      let projectContext: string | null = null;
      if (session.project_id) {
        // Use the first respondent for context access check
        projectContext = await buildProjectContextInjection(session.project_id, respondents[0]);
      }

      // 6. Build entity context from message mentions
      const entityContext = buildEntityContextBlock(mentions);

      // 7. Send to each respondent sequentially
      for (let i = 0; i < respondents.length; i++) {
        if (cancelRef.current) {
          if (listenerCleanupRef.current) {
            listenerCleanupRef.current();
            listenerCleanupRef.current = null;
          }
          break;
        }

        const agentId = respondents[i];
        const agentTurn = nextTurn + 1 + i;

        // Set speaking state
        const s = useBoardroomStore.getState();
        s.setCurrentSpeakingAgentId(agentId);
        s.setChatStreamingForAgent(agentId, '');

        // Combine additional context blocks
        const additionalParts: string[] = [];
        if (projectContext) additionalParts.push(projectContext);
        if (entityContext) additionalParts.push(entityContext);
        const additionalContext = additionalParts.length > 0 ? additionalParts.join('\n\n') : undefined;

        // Build prompt using shared utility
        const prompt = buildAgentPrompt({
          agentId,
          session,
          conversationHistory: recentHistory,
          turnNumber: agentTurn,
          agentProfiles: currentProfiles,
          customInstructions: 'You are in a project team chat. Respond naturally and helpfully to the user\'s latest message. Build on what other team members have said. Be concise but thorough. If the question is outside your expertise, say so and suggest which team member might be better suited. Do NOT repeat what others have already said.',
          additionalContext,
        });

        // Session key: separate namespace from regular boardroom turns
        const sessionKey = `boardroom:${sessionId}:${agentId}:chat`;
        const idempotencyKey = `chat-${sessionId}-${agentTurn}-${Date.now()}`;

        try {
          let streamBuffer = '';
          let reasoningBuffer = '';
          let resolved = false;
          const acceptedRunIds = new Set<string>([idempotencyKey]);

          // RAF-debounced store updates (~60fps cap instead of per-delta)
          let rafId: number | null = null;
          const scheduleStoreFlush = () => {
            if (rafId === null) {
              rafId = requestAnimationFrame(() => {
                const st = useBoardroomStore.getState();
                st.setChatStreamingForAgent(agentId, streamBuffer);
                if (reasoningBuffer) {
                  st.setChatStreamingReasoningForAgent(agentId, reasoningBuffer);
                }
                rafId = null;
              });
            }
          };

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
                }
                if (reasoning) {
                  reasoningBuffer = mergeDeltaBuffer(reasoningBuffer, reasoning);
                }
                if (text || reasoning) {
                  scheduleStoreFlush();
                }
              }

              if (payload.state === 'final') {
                if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
                const text = extractText(payload.message);
                const reasoning = extractReasoning(payload.message);
                const finalText = mergeDeltaBuffer(streamBuffer, text);
                const finalReasoning = mergeDeltaBuffer(reasoningBuffer, reasoning);
                // Sync flush final state to store
                const st = useBoardroomStore.getState();
                st.setChatStreamingForAgent(agentId, finalText);
                if (finalReasoning) {
                  st.setChatStreamingReasoningForAgent(agentId, finalReasoning);
                }
                resolved = true;
                unsub();
                resolve({ text: finalText, reasoning: finalReasoning });
              }

              if (payload.state === 'error' || payload.state === 'aborted') {
                resolved = true;
                unsub();
                reject(new Error(payload.errorMessage || `Chat turn ${payload.state}`));
              }
            });

            listenerCleanupRef.current = unsub;

            // Timeout safety: 2 minutes per agent
            setTimeout(() => {
              if (!resolved) {
                unsub();
                if (streamBuffer) {
                  resolve({ text: streamBuffer, reasoning: reasoningBuffer });
                } else {
                  reject(new Error('Chat turn timeout'));
                }
              }
            }, 120_000);
          });

          // Send the chat request to OpenClaw
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

          if (cancelRef.current) {
            if (listenerCleanupRef.current) {
              listenerCleanupRef.current();
              listenerCleanupRef.current = null;
            }
            break;
          }

          // Persist agent message to Supabase
          await addMessageToSession({
            session_id: sessionId,
            agent_id: agentId,
            content: text,
            reasoning: reasoning || undefined,
            turn_number: agentTurn,
            sender_type: 'agent',
            mentions: [],
          });

          // Clear streaming state for this agent
          const s2 = useBoardroomStore.getState();
          s2.clearChatStreamingForAgent(agentId);
          s2.clearChatStreamingReasoningForAgent(agentId);
          s2.setCurrentSpeakingAgentId(null);

          // Brief delay between agents for readability
          if (i < respondents.length - 1 && !cancelRef.current) {
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch (err) {
          console.error(`[BoardroomChat] Error for agent ${agentId}:`, err);
          const s2 = useBoardroomStore.getState();
          s2.clearChatStreamingForAgent(agentId);
          s2.clearChatStreamingReasoningForAgent(agentId);
          s2.setCurrentSpeakingAgentId(null);
          // Continue to next agent even on error
        }
      }

      // Done
      const finalStore = useBoardroomStore.getState();
      finalStore.setIsChatSending(false);
      finalStore.setChatRespondingAgents([]);
      finalStore.setCurrentSpeakingAgentId(null);
    },
    [addMessageToSession]
  );

  return {
    sendChatMessage,
    cancelChat,
    isChatSending,
    chatStreamingByAgent,
    chatRespondingAgents,
  };
}
