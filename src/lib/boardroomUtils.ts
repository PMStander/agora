// ─── Shared Boardroom Utilities ──────────────────────────────────────────────
// Extracted from useBoardroomOrchestrator for reuse in chat mode

import { getSessionPreset, type BoardroomMessage, type BoardroomSession, type BoardroomSessionMetadata } from '../types/boardroom';
import { determineSessionPhase, getPhaseGuidance } from './boardroomSmartRouting';
import { hydrateEntityReferences } from './boardroomDataContext';

// ─── Message Parsing ─────────────────────────────────────────────────────────

export function extractText(message: any): string {
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

export function extractReasoning(message: any): string {
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

export function mergeDeltaBuffer(previous: string, incoming: string): string {
  if (!incoming) return previous;
  if (!previous) return incoming;

  // Fast path: exact cumulative match (incoming extends previous)
  if (incoming.startsWith(previous)) return incoming;
  // Fast path: stale/duplicate (previous already contains incoming)
  if (previous.startsWith(incoming)) return previous;

  // Longest Common Prefix (LCP) — detects cumulative mode even when
  // minor whitespace/formatting differences break exact startsWith.
  const maxCheck = Math.min(previous.length, incoming.length);
  let commonLen = 0;
  for (let i = 0; i < maxCheck; i++) {
    if (previous[i] === incoming[i]) commonLen = i + 1;
    else break;
  }

  // If >50% of previous is a shared prefix → cumulative with drift.
  // If incoming is shorter or equal, it's stale — keep previous.
  // If incoming is strictly longer, it has new content — use it.
  if (commonLen > previous.length * 0.5) {
    return incoming.length > previous.length ? incoming : previous;
  }

  // Large incoming with no/low prefix overlap → likely a full replacement
  // (reformatted response or different content). Replace is safer than
  // append — a brief flicker beats garbled/duplicated text.
  if (incoming.length > previous.length * 0.5) {
    return incoming;
  }

  // Genuine small chunk/token append (short incoming, no prefix overlap).
  if (import.meta.env?.DEV) {
    console.debug('[mergeDelta] append fallback', {
      prevLen: previous.length,
      incLen: incoming.length,
      commonLen,
      incHead: incoming.slice(0, 40),
    });
  }

  // Check for suffix-prefix overlap to avoid partial duplication
  const maxOverlap = Math.min(previous.length, incoming.length);
  for (let len = maxOverlap; len > 0; len--) {
    if (previous.endsWith(incoming.slice(0, len))) {
      return previous + incoming.slice(len);
    }
  }

  // No overlap — insert space if both sides are non-whitespace to prevent word gluing
  const needsSpace = previous.length > 0 && incoming.length > 0 &&
    !/\s$/.test(previous) && !/^\s/.test(incoming);
  return previous + (needsSpace ? ' ' : '') + incoming;
}

// ─── Agent Prompt Building ───────────────────────────────────────────────────

export interface AgentPromptOptions {
  agentId: string;
  session: BoardroomSession;
  conversationHistory: BoardroomMessage[];
  turnNumber: number;
  agentProfiles: Record<string, any>;
  /** Override instructions (used by chat mode instead of session preset guidance) */
  customInstructions?: string;
  /** Additional context blocks to inject (e.g. project context, entity refs) */
  additionalContext?: string;
}

export function buildAgentPrompt(options: AgentPromptOptions): string {
  const { agentId, session, conversationHistory, turnNumber, agentProfiles, customInstructions, additionalContext } = options;
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

  // Build conversation history (include user messages for chat mode)
  const historyLines = conversationHistory.map((msg) => {
    if (msg.sender_type === 'user') {
      return `[Turn ${msg.turn_number}] User: ${msg.content}`;
    }
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
  if (session.session_type !== 'chat') {
    parts.push(`Turn ${turnNumber} of ${session.max_turns}`);
    
    // Add phase awareness
    const phase = determineSessionPhase(turnNumber, session.max_turns);
    const remainingTurns = session.max_turns - turnNumber + 1;
    const phaseGuidance = getPhaseGuidance(phase, remainingTurns);
    parts.push(phaseGuidance);
  }

  // Entity references — hydrate with live business data from CRM/Products/Projects
  const metadata = session.metadata as BoardroomSessionMetadata | undefined;
  if (metadata?.entity_references?.length) {
    const hydratedData = hydrateEntityReferences(metadata.entity_references);
    if (hydratedData) {
      // Full hydrated data with real CRM/product/project details
      parts.push('');
      parts.push(hydratedData);
      parts.push('Use this live business data to ground your responses in real numbers and context.');
    } else {
      // Fallback to simple labels if stores are empty or entities not found
      parts.push('');
      parts.push('=== REFERENCED ENTITIES ===');
      for (const ref of metadata.entity_references) {
        parts.push(`- ${ref.emoji || ''} [${ref.type}] ${ref.label}`);
      }
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

  // Additional context (project context, entity references from mentions, etc.)
  if (additionalContext) {
    parts.push('');
    parts.push(additionalContext);
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
  parts.push(customInstructions || preset.guidance);
  parts.push('Stay fully in character. Respond to what others have said. Be concise but substantive.');
  if (historyLines.length === 0) {
    parts.push('You are opening the conversation. Set the tone.');
  }

  return parts.join('\n');
}
