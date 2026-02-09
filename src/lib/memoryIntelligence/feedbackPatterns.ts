/**
 * Feedback Pattern Extractor
 * Analyzes review feedback, mission outcomes, and approval/rejection history
 * to extract persistent patterns that agents should learn from.
 *
 * Patterns are stored in agent_learned_patterns and injected into agent context
 * via the semantic recall system.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import type { AgentLearnedPattern, PatternType, PatternExample } from '../../types/memoryIntelligence';

/**
 * Extract patterns from recent mission review history for an agent.
 * Analyzes tasks table review_history JSONB field.
 */
export async function extractFeedbackPatterns(agentId: string): Promise<AgentLearnedPattern[]> {
  if (!isSupabaseConfigured()) return [];

  // 1. Fetch recent tasks with review history for this agent
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, review_history, status, assigned_agent_id')
    .eq('assigned_agent_id', agentId)
    .gte('updated_at', thirtyDaysAgo)
    .not('review_history', 'is', null);

  if (error) {
    console.error('[FeedbackPatterns] fetch tasks error:', error);
    return [];
  }

  if (!tasks || tasks.length === 0) return [];

  // 2. Analyze review history for rejection patterns
  const rejectionReasons: Map<string, { count: number; examples: PatternExample[] }> = new Map();
  const approvalPatterns: Map<string, { count: number; examples: PatternExample[] }> = new Map();

  for (const task of tasks) {
    const history = (task.review_history || []) as Array<{
      action: string;
      summary?: string;
      specific_issues?: string[];
      new_instructions?: string;
      timestamp?: string;
    }>;

    for (const review of history) {
      const example: PatternExample = {
        date: review.timestamp || new Date().toISOString(),
        context: task.title || 'Unknown task',
        outcome: review.action === 'approve' ? 'approved' : review.action === 'revise' ? 'revised' : 'rejected',
      };

      if (review.action === 'revise' || review.action === 'redo') {
        // Extract specific issues as rejection patterns
        const issues = review.specific_issues || [];
        for (const issue of issues) {
          const normalized = issue.toLowerCase().trim();
          const existing = rejectionReasons.get(normalized);
          if (existing) {
            existing.count++;
            existing.examples.push(example);
          } else {
            rejectionReasons.set(normalized, { count: 1, examples: [example] });
          }
        }

        // Also capture new_instructions as preferences
        if (review.new_instructions) {
          const key = review.new_instructions.toLowerCase().trim().slice(0, 200);
          const existing = approvalPatterns.get(key);
          if (existing) {
            existing.count++;
            existing.examples.push(example);
          } else {
            approvalPatterns.set(key, { count: 1, examples: [example] });
          }
        }
      }
    }
  }

  // 3. Upsert patterns that appear 2+ times (signal, not noise)
  const newPatterns: AgentLearnedPattern[] = [];

  for (const [reason, data] of rejectionReasons) {
    if (data.count >= 2 || reason.length > 50) {  // Detailed reasons count even once
      const pattern = await upsertPattern(agentId, 'mistake', reason, data.count, data.examples);
      if (pattern) newPatterns.push(pattern);
    }
  }

  for (const [instruction, data] of approvalPatterns) {
    if (data.count >= 1) {
      const pattern = await upsertPattern(agentId, 'preference', instruction, data.count, data.examples);
      if (pattern) newPatterns.push(pattern);
    }
  }

  return newPatterns;
}

/**
 * Record feedback for an agent action (approve/reject/revise).
 * Call this whenever a user makes a decision on agent output.
 */
export async function recordAgentFeedback(
  agentId: string,
  action: 'approved' | 'rejected' | 'revised',
  context: string,
  reason?: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  if (action === 'rejected' && reason) {
    await upsertPattern(agentId, 'rejection_reason', reason, 1, [{
      date: new Date().toISOString(),
      context,
      outcome: action,
    }]);
  }

  if (action === 'approved') {
    // Track what works
    await upsertPattern(agentId, 'success_pattern', context, 1, [{
      date: new Date().toISOString(),
      context,
      outcome: action,
    }]);
  }
}

/**
 * Get all active "mistake" patterns for an agent -- things to avoid.
 */
export async function getAgentMistakes(agentId: string): Promise<AgentLearnedPattern[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('agent_learned_patterns')
    .select('*')
    .eq('agent_id', agentId)
    .in('pattern_type', ['mistake', 'rejection_reason'])
    .eq('active', true)
    .order('source_count', { ascending: false });

  if (error) {
    console.error('[FeedbackPatterns] getAgentMistakes error:', error);
    return [];
  }

  return (data || []) as AgentLearnedPattern[];
}

/**
 * Upsert a pattern -- increment count if exists, create if new.
 */
async function upsertPattern(
  agentId: string,
  patternType: PatternType,
  pattern: string,
  count: number,
  examples: PatternExample[]
): Promise<AgentLearnedPattern | null> {
  if (!isSupabaseConfigured()) return null;

  // Check if a similar pattern already exists
  const { data: existing } = await supabase
    .from('agent_learned_patterns')
    .select('*')
    .eq('agent_id', agentId)
    .eq('pattern_type', patternType)
    .eq('pattern', pattern)
    .maybeSingle();

  if (existing) {
    // Update count and add new examples
    const allExamples = [...(existing.examples || []), ...examples].slice(-10);  // keep last 10
    const newCount = (existing.source_count || 0) + count;
    const confidence = Math.min(0.95, 0.3 + (newCount * 0.1));  // grows with observations

    const { data, error } = await supabase
      .from('agent_learned_patterns')
      .update({
        source_count: newCount,
        confidence,
        examples: allExamples,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('[FeedbackPatterns] update pattern error:', error);
      return null;
    }
    return data as AgentLearnedPattern;
  }

  // Create new pattern
  const confidence = Math.min(0.95, 0.3 + (count * 0.1));

  const { data, error } = await supabase
    .from('agent_learned_patterns')
    .insert({
      agent_id: agentId,
      pattern_type: patternType,
      pattern,
      source_count: count,
      confidence,
      examples: examples.slice(-10),
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[FeedbackPatterns] insert pattern error:', error);
    return null;
  }

  return data as AgentLearnedPattern;
}
