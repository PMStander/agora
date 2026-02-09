/**
 * Semantic Recall Engine
 * Automatically retrieves relevant past context before an agent prompt is sent.
 *
 * Pipeline:
 *   agentPrompt -> semanticSearch -> format context -> inject into prompt
 */

import { semanticSearch } from './embeddingService';
import { supabase, isSupabaseConfigured } from '../supabase';
import type { SemanticSearchResult, MemorySummary, AgentLearnedPattern } from '../../types/memoryIntelligence';

export interface RecalledContext {
  memories: SemanticSearchResult[];
  patterns: AgentLearnedPattern[];
  recentSummary: MemorySummary | null;
  formattedContext: string;  // ready-to-inject string for the agent
}

/**
 * Recall relevant context for an agent before sending a message.
 * This is the main entry point -- call before every agent interaction.
 */
export async function recallContextForAgent(
  agentId: string,
  userMessage: string,
  options?: {
    maxMemories?: number;
    includePatterns?: boolean;
    includeRecentSummary?: boolean;
  }
): Promise<RecalledContext> {
  const {
    maxMemories = 5,
    includePatterns = true,
    includeRecentSummary = true,
  } = options || {};

  const empty: RecalledContext = {
    memories: [],
    patterns: [],
    recentSummary: null,
    formattedContext: '',
  };

  if (!isSupabaseConfigured() || !userMessage.trim()) return empty;

  // Run all queries in parallel
  const [memories, patterns, recentSummary] = await Promise.all([
    // 1. Semantic search for relevant past memories
    semanticSearch(userMessage, {
      agentId,
      threshold: 0.3,
      limit: maxMemories,
    }),

    // 2. Get active learned patterns for this agent
    includePatterns ? getActivePatterns(agentId) : Promise.resolve([]),

    // 3. Get most recent daily/hourly summary
    includeRecentSummary ? getRecentSummary(agentId) : Promise.resolve(null),
  ]);

  // Format the recalled context as a string the agent can consume
  const formattedContext = formatRecalledContext(memories, patterns, recentSummary);

  return {
    memories,
    patterns,
    recentSummary,
    formattedContext,
  };
}

/**
 * Get active learned patterns for an agent.
 */
async function getActivePatterns(agentId: string): Promise<AgentLearnedPattern[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('agent_learned_patterns')
    .select('*')
    .eq('agent_id', agentId)
    .eq('active', true)
    .order('confidence', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[SemanticRecall] getActivePatterns error:', error);
    return [];
  }

  return (data || []) as AgentLearnedPattern[];
}

/**
 * Get the most recent summary for an agent.
 */
async function getRecentSummary(agentId: string): Promise<MemorySummary | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('memory_summaries')
    .select('*')
    .eq('agent_id', agentId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[SemanticRecall] getRecentSummary error:', error);
    return null;
  }

  return data as MemorySummary | null;
}

/**
 * Format recalled context into a string that can be injected into agent context.
 */
function formatRecalledContext(
  memories: SemanticSearchResult[],
  patterns: AgentLearnedPattern[],
  recentSummary: MemorySummary | null
): string {
  const parts: string[] = [];

  // Relevant past memories
  if (memories.length > 0) {
    parts.push('## Recalled Memories');
    memories.forEach((m, i) => {
      const similarity = (m.similarity * 100).toFixed(0);
      parts.push(`${i + 1}. [${m.source_type}] (${similarity}% match) ${m.content_text.slice(0, 300)}`);
    });
  }

  // Learned patterns -- mistakes to avoid, preferences to follow
  const mistakes = patterns.filter(p => p.pattern_type === 'mistake');
  const prefs = patterns.filter(p => p.pattern_type === 'preference' || p.pattern_type === 'style_guide');
  const successes = patterns.filter(p => p.pattern_type === 'success_pattern');

  if (mistakes.length > 0) {
    parts.push('\n## Mistakes to Avoid');
    mistakes.forEach(p => parts.push(`- ${p.pattern}`));
  }

  if (prefs.length > 0) {
    parts.push('\n## Known Preferences');
    prefs.forEach(p => parts.push(`- ${p.pattern}`));
  }

  if (successes.length > 0) {
    parts.push('\n## Successful Patterns');
    successes.slice(0, 5).forEach(p => parts.push(`- ${p.pattern}`));
  }

  // Recent summary for continuity
  if (recentSummary) {
    parts.push(`\n## Recent Context (${recentSummary.summary_type})`);
    parts.push(recentSummary.summary_text.slice(0, 500));
    if (recentSummary.decisions.length > 0) {
      parts.push('Recent decisions:');
      recentSummary.decisions.slice(0, 3).forEach(d => parts.push(`- ${d.description}`));
    }
  }

  return parts.join('\n');
}

/**
 * Get formatted priority stack for an agent.
 * Agents should read this before every action.
 */
export async function getPriorityContext(
  agentId: string,
  teamId?: string
): Promise<string> {
  if (!isSupabaseConfigured()) return '';

  const { data, error } = await supabase
    .from('shared_priorities')
    .select('*')
    .eq('status', 'active')
    .order('priority_rank', { ascending: true });

  if (error || !data?.length) return '';

  // Filter by applicable scopes
  const applicable = data.filter(p => {
    if (p.scope === 'global') return true;
    if (p.scope === 'team' && p.scope_target === teamId) return true;
    if (p.scope === 'agent' && p.scope_target === agentId) return true;
    return false;
  });

  if (applicable.length === 0) return '';

  const lines = ['## Current Priorities'];
  applicable.forEach((p: Record<string, unknown>, i: number) => {
    const title = p.title as string;
    const description = p.description as string | null;
    lines.push(`${i + 1}. **${title}**${description ? ` -- ${description}` : ''}`);
  });

  return lines.join('\n');
}
