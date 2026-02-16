// ─── Boardroom Smart Routing ─────────────────────────────────────────────────
// Intelligent agent selection based on relevance, participation balance, and topic flow

import type { BoardroomSession, BoardroomMessage, SessionPhase, TurnTracking, BoardroomSessionMetadata } from '../types/boardroom';

// ─── Phase Determination ─────────────────────────────────────────────────────

export function determineSessionPhase(currentTurn: number, maxTurns: number): SessionPhase {
  const progress = currentTurn / maxTurns;
  
  if (progress <= 0.2) return 'opening';
  if (progress >= 0.8) return 'wrap-up';
  return 'discussion';
}

export function getRemainingTurns(currentTurn: number, maxTurns: number): number {
  return Math.max(0, maxTurns - currentTurn);
}

export function getPhaseGuidance(phase: SessionPhase, remainingTurns: number): string {
  switch (phase) {
    case 'opening':
      return 'Opening phase: Present your initial perspective on the topic.';
    case 'wrap-up':
      return `Wrap-up phase (${remainingTurns} turns left): Synthesize key decisions, action items, and any unresolved disagreements.`;
    case 'discussion':
      return `Discussion phase (${remainingTurns} turns left): Engage deeply with the ideas being discussed.`;
  }
}

// ─── Turn Tracking ───────────────────────────────────────────────────────────

export function initializeTurnTracking(participantIds: string[]): TurnTracking[] {
  return participantIds.map(agent_id => ({
    agent_id,
    turn_count: 0,
  }));
}

export function updateTurnTracking(
  tracking: TurnTracking[],
  agentId: string,
  turnNumber: number
): TurnTracking[] {
  return tracking.map(t =>
    t.agent_id === agentId
      ? { ...t, turn_count: t.turn_count + 1, last_spoke_turn: turnNumber }
      : t
  );
}

export function markAgentMentioned(
  tracking: TurnTracking[],
  agentId: string,
  turnNumber: number
): TurnTracking[] {
  return tracking.map(t =>
    t.agent_id === agentId
      ? { ...t, last_mentioned_turn: turnNumber }
      : t
  );
}

// ─── Relevance Scoring ────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'is', 'was', 'are', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'should', 'could', 'can', 'may', 'might', 'i', 'you', 'he', 'she',
  'it', 'we', 'they', 'this', 'that', 'these', 'those', 'what', 'who', 'when', 'where',
  'why', 'how', 'not', 'no', 'yes', 'so', 'if', 'then', 'than', 'also', 'just', 'about',
  'up', 'out', 'all', 'some', 'any', 'each', 'every', 'into', 'over', 'after', 'before',
]);

function extractKeywords(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
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

function scoreAgentRelevance(
  agentId: string,
  recentMessages: BoardroomMessage[],
  agentProfiles: Record<string, any>
): number {
  const profile = agentProfiles[agentId];
  if (!profile) return 0;

  let score = 0;
  const corpus = buildAgentCorpus(profile);
  const agentNameLower = profile.name.toLowerCase();
  const agentRoleLower = (profile.role || '').toLowerCase();

  // Analyze last 2-3 messages for topic relevance
  const relevantMessages = recentMessages.slice(-3);
  
  for (const msg of relevantMessages) {
    const content = msg.content.toLowerCase();
    
    // Direct mention (highest weight)
    if (content.includes(agentNameLower) || content.includes(`@${agentNameLower}`)) {
      score += 20;
    }
    
    // Role mention
    if (agentRoleLower && content.includes(agentRoleLower)) {
      score += 15;
    }
    
    // Keyword overlap with agent's domain
    const keywords = extractKeywords(msg.content);
    for (const keyword of keywords) {
      if (agentRoleLower.includes(keyword)) {
        score += 8;
      } else if (corpus.includes(keyword)) {
        score += 3;
      }
    }
  }

  return score;
}

// ─── Participation Balance ───────────────────────────────────────────────────

function scoreParticipationBalance(
  agentId: string,
  turnTracking: TurnTracking[],
  currentTurn: number
): number {
  const agentStats = turnTracking.find(t => t.agent_id === agentId);
  if (!agentStats) return 0;

  const avgTurns = turnTracking.reduce((sum, t) => sum + t.turn_count, 0) / turnTracking.length;
  const turnDiff = avgTurns - agentStats.turn_count;
  
  // Bonus for agents who haven't spoken much
  let score = turnDiff * 10;
  
  // Penalty for speaking very recently
  if (agentStats.last_spoke_turn) {
    const turnsSinceSpoke = currentTurn - agentStats.last_spoke_turn;
    if (turnsSinceSpoke < 2) {
      score -= 15; // Don't let same agent speak back-to-back
    } else if (turnsSinceSpoke < 4) {
      score -= 5;
    }
  }
  
  return score;
}

// ─── Opening Phase Logic ─────────────────────────────────────────────────────

function selectNextSpeakerForOpening(
  participants: string[],
  turnTracking: TurnTracking[]
): string {
  // In opening phase, ensure everyone gets a turn in order
  const unspoken = participants.filter(agentId => {
    const stats = turnTracking.find(t => t.agent_id === agentId);
    return !stats || stats.turn_count === 0;
  });
  
  if (unspoken.length > 0) {
    return unspoken[0]; // First participant who hasn't spoken
  }
  
  // Everyone has spoken at least once, continue with smart routing
  return participants[0];
}

// ─── Smart Speaker Selection ─────────────────────────────────────────────────

export interface SpeakerSelectionContext {
  session: BoardroomSession;
  conversationHistory: BoardroomMessage[];
  currentTurn: number;
  agentProfiles: Record<string, any>;
}

export function selectNextSpeaker(context: SpeakerSelectionContext): {
  agentId: string;
  reasoning: string;
} {
  const { session, conversationHistory, currentTurn, agentProfiles } = context;
  const metadata = (session.metadata || {}) as BoardroomSessionMetadata;
  const participants = session.participant_agent_ids;
  
  if (participants.length === 0) {
    return { agentId: '', reasoning: 'No participants' };
  }
  
  if (participants.length === 1) {
    return { agentId: participants[0], reasoning: 'Only one participant' };
  }

  // Initialize turn tracking if not present
  const turnTracking = metadata.turn_tracking || initializeTurnTracking(participants);
  const phase = metadata.current_phase || determineSessionPhase(currentTurn, session.max_turns);
  
  // Opening phase: ensure everyone speaks once
  if (phase === 'opening') {
    const speaker = selectNextSpeakerForOpening(participants, turnTracking);
    return {
      agentId: speaker,
      reasoning: 'Opening phase: ensuring all participants introduce their perspective',
    };
  }
  
  // Smart routing for discussion and wrap-up phases
  const scores: Array<{ agentId: string; relevance: number; balance: number; total: number }> = [];
  
  for (const agentId of participants) {
    const relevance = scoreAgentRelevance(agentId, conversationHistory, agentProfiles);
    const balance = scoreParticipationBalance(agentId, turnTracking, currentTurn);
    const total = relevance + balance;
    
    scores.push({ agentId, relevance, balance, total });
  }
  
  // Sort by total score (highest first)
  scores.sort((a, b) => b.total - a.total);
  
  const winner = scores[0];
  const profile = agentProfiles[winner.agentId];
  const agentName = profile ? profile.name : winner.agentId;
  
  const reasoning = `Selected ${agentName}: relevance=${winner.relevance.toFixed(1)}, balance=${winner.balance.toFixed(1)}, total=${winner.total.toFixed(1)}`;
  
  return {
    agentId: winner.agentId,
    reasoning,
  };
}

// ─── Round-Robin Fallback ────────────────────────────────────────────────────

export function selectNextSpeakerRoundRobin(
  participants: string[],
  currentTurn: number
): string {
  if (participants.length === 0) return '';
  const index = (currentTurn - 1) % participants.length;
  return participants[index];
}

// ─── Summary Generation ──────────────────────────────────────────────────────

export function shouldGenerateSummary(session: BoardroomSession, currentTurn: number): boolean {
  return currentTurn >= session.max_turns;
}

export function buildSummaryPrompt(
  session: BoardroomSession,
  conversationHistory: BoardroomMessage[],
  agentProfiles: Record<string, any>
): string {
  const parts: string[] = [];
  
  parts.push('=== BOARDROOM SESSION SUMMARY REQUEST ===');
  parts.push(`Session: ${session.title}`);
  parts.push(`Type: ${session.session_type}`);
  if (session.topic) parts.push(`Topic: ${session.topic}`);
  parts.push('');
  
  parts.push('=== FULL CONVERSATION ===');
  for (const msg of conversationHistory) {
    const profile = agentProfiles[msg.agent_id];
    const name = profile ? `${profile.emoji} ${profile.name}` : msg.agent_id;
    parts.push(`[Turn ${msg.turn_number}] ${name}:`);
    parts.push(msg.content);
    parts.push('');
  }
  
  parts.push('=== INSTRUCTIONS ===');
  parts.push('Generate a comprehensive summary of this boardroom session in the following format:');
  parts.push('');
  parts.push('## Key Decisions');
  parts.push('- List each decision that was reached during the discussion');
  parts.push('');
  parts.push('## Action Items');
  parts.push('- [ ] Task description (Owner: agent name if mentioned)');
  parts.push('');
  parts.push('## Unresolved Items');
  parts.push('- List topics or questions that remain open for future discussion');
  parts.push('');
  parts.push('Be specific and actionable. Extract concrete commitments and next steps.');
  
  return parts.join('\n');
}
