// ─── Boardroom Smart Routing Tests ────────────────────────────────────────────

import { 
  determineSessionPhase, 
  initializeTurnTracking, 
  updateTurnTracking,
  scoreAgentsForNextTurn,
  extractMentionedAgents,
} from '../boardroomSmartRouting';

describe('boardroomSmartRouting', () => {
  describe('determineSessionPhase', () => {
    it('should return opening for first 20% of turns', () => {
      expect(determineSessionPhase(1, 10)).toBe('opening');
      expect(determineSessionPhase(2, 10)).toBe('opening');
    });

    it('should return discussion for middle 60%', () => {
      expect(determineSessionPhase(3, 10)).toBe('discussion');
      expect(determineSessionPhase(5, 10)).toBe('discussion');
      expect(determineSessionPhase(7, 10)).toBe('discussion');
    });

    it('should return wrap-up for final 20%', () => {
      expect(determineSessionPhase(8, 10)).toBe('wrap-up');
      expect(determineSessionPhase(9, 10)).toBe('wrap-up');
      expect(determineSessionPhase(10, 10)).toBe('wrap-up');
    });
  });

  describe('initializeTurnTracking', () => {
    it('should create tracking entries for all participants', () => {
      const tracking = initializeTurnTracking(['agent1', 'agent2', 'agent3']);
      expect(tracking).toHaveLength(3);
      expect(tracking[0]).toEqual({ agent_id: 'agent1', turn_count: 0 });
    });
  });

  describe('updateTurnTracking', () => {
    it('should increment turn count for speaking agent', () => {
      const tracking = initializeTurnTracking(['agent1', 'agent2']);
      const updated = updateTurnTracking(tracking, 'agent1', 1);
      expect(updated[0].turn_count).toBe(1);
      expect(updated[1].turn_count).toBe(0);
    });
  });

  describe('scoreAgentsForNextTurn', () => {
    it('should prioritize agents who have not spoken in opening phase', () => {
      const tracking = [
        { agent_id: 'agent1', turn_count: 0 },
        { agent_id: 'agent2', turn_count: 1 },
      ];
      const scores = scoreAgentsForNextTurn(
        ['agent1', 'agent2'],
        tracking,
        1,
        'opening',
        {}
      );
      expect(scores[0].agentId).toBe('agent1');
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
    });

    it('should penalize agents who spoke more often', () => {
      const tracking = [
        { agent_id: 'agent1', turn_count: 3 },
        { agent_id: 'agent2', turn_count: 1 },
      ];
      const scores = scoreAgentsForNextTurn(
        ['agent1', 'agent2'],
        tracking,
        5,
        'discussion',
        {}
      );
      expect(scores[0].agentId).toBe('agent2');
    });

    it('should boost recently mentioned agents', () => {
      const tracking = [
        { agent_id: 'agent1', turn_count: 1, last_mentioned_turn: 5 },
        { agent_id: 'agent2', turn_count: 1 },
      ];
      const scores = scoreAgentsForNextTurn(
        ['agent1', 'agent2'],
        tracking,
        6,
        'discussion',
        {}
      );
      expect(scores[0].agentId).toBe('agent1');
    });
  });

  describe('extractMentionedAgents', () => {
    it('should detect agent names in content', () => {
      const agentProfiles = {
        'agent1': { name: 'Marcus Aurelius' },
        'agent2': { name: 'Alexander' },
      };
      const content = 'I agree with Marcus Aurelius on this point.';
      const mentioned = extractMentionedAgents(content, agentProfiles);
      expect(mentioned).toContain('agent1');
      expect(mentioned).not.toContain('agent2');
    });

    it('should be case-insensitive', () => {
      const agentProfiles = {
        'agent1': { name: 'Marcus Aurelius' },
      };
      const content = 'MARCUS AURELIUS makes a good point.';
      const mentioned = extractMentionedAgents(content, agentProfiles);
      expect(mentioned).toContain('agent1');
    });
  });
});
