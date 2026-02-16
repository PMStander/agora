// ─── Boardroom User Participation Helpers ─────────────────────────────────────

import type { BoardroomSession, BoardroomSessionMetadata } from '../types/boardroom';

/**
 * Check if a participant ID represents the user
 */
export function isUserParticipant(participantId: string): boolean {
  return participantId === 'user' || participantId === 'human' || participantId.startsWith('user:');
}

/**
 * Check if session has user participation enabled
 */
export function hasUserParticipation(session: BoardroomSession): boolean {
  const metadata = session.metadata as BoardroomSessionMetadata;
  return metadata?.user_participation?.enabled || session.participant_agent_ids.some(isUserParticipant);
}

/**
 * Get user participant ID from session
 */
export function getUserParticipantId(session: BoardroomSession): string | null {
  const userId = session.participant_agent_ids.find(isUserParticipant);
  return userId || null;
}

/**
 * Get default user turn timeout (5 minutes in milliseconds)
 */
export function getUserTurnTimeout(session: BoardroomSession): number {
  const metadata = session.metadata as BoardroomSessionMetadata;
  return metadata?.user_participation?.user_turn_timeout_ms || 300_000; // 5 min default
}

/**
 * Check if orchestrator should wait for user input
 */
export function shouldWaitForUser(
  _session: BoardroomSession,
  currentAgentId: string
): boolean {
  return isUserParticipant(currentAgentId);
}

/**
 * Get user display info
 */
export function getUserDisplayInfo(): { name: string; emoji: string; avatar: string } {
  // In production, this would come from user context/auth
  // For now, return defaults
  return {
    name: 'Peet',
    emoji: '👤',
    avatar: '/avatars/user.png',
  };
}
