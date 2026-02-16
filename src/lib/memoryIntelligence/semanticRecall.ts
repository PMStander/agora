/**
 * Semantic Recall Engine
 * Automatically retrieves relevant past context before an agent prompt is sent.
 *
 * Pipeline:
 *   agentPrompt -> semanticSearch -> format context -> inject into prompt
 */

import { semanticSearch } from './embeddingService';
import { supabase, isSupabaseConfigured } from '../supabase';
import { searchEntities } from '../embeddingSearch';
import type { SemanticSearchResult, MemorySummary, AgentLearnedPattern } from '../../types/memoryIntelligence';
import type { EmbeddableEntityType } from '../../types/entityEmbeddings';

// ─── Entity Type Detection ───────────────────────────────────────────────────
// Maps keywords in user messages to entity type filters so auto-injection
// returns more focused results for specific queries.

const ENTITY_TYPE_KEYWORDS: Array<{ pattern: RegExp; types: EmbeddableEntityType[] }> = [
  { pattern: /\b(compan(?:y|ies)|firms?|org(?:anization)?s?)\b/i, types: ['company'] },
  { pattern: /\b(contacts?|people|person|leads?)\b/i, types: ['contact'] },
  { pattern: /\b(deals?|opportunit(?:y|ies)|pipeline)\b/i, types: ['deal'] },
  { pattern: /\b(products?|items?|SKU|inventory)\b/i, types: ['product', 'product_category'] },
  { pattern: /\b(quotes?|quotations?|proposals?)\b/i, types: ['quote'] },
  { pattern: /\b(invoices?|billing|payments?)\b/i, types: ['invoice'] },
  { pattern: /\b(projects?)\b/i, types: ['project'] },
  { pattern: /\b(missions?|tasks?|assignments?)\b/i, types: ['mission', 'task'] },
  { pattern: /\b(emails?|threads?)\b/i, types: ['email', 'email_template'] },
  { pattern: /\b(events?|calendar|meetings?|schedule)\b/i, types: ['calendar_event'] },
  { pattern: /\b(workflows?|automations?|sequences?)\b/i, types: ['workflow', 'workflow_sequence'] },
  { pattern: /\b(docs?|documents?|files?|contracts?)\b/i, types: ['document', 'crm_document'] },
  { pattern: /\b(orders?)\b/i, types: ['order'] },
  { pattern: /\b(agents?|team\s*members?)\b/i, types: ['agent'] },
  { pattern: /\b(boardroom|board\s*meeting|minutes|session)\b/i, types: ['boardroom_message'] },
];

/**
 * Detect entity types mentioned in a user message.
 * Returns undefined (search all) if no specific types detected or if too many
 * different categories are mentioned (broad query).
 */
function detectEntityTypes(message: string): EmbeddableEntityType[] | undefined {
  const matched = new Set<EmbeddableEntityType>();
  let matchCount = 0;

  for (const { pattern, types } of ENTITY_TYPE_KEYWORDS) {
    if (pattern.test(message)) {
      types.forEach((t) => matched.add(t));
      matchCount++;
    }
  }

  // No matches or 4+ categories → broad query, search everything
  if (matched.size === 0 || matchCount >= 4) return undefined;

  return Array.from(matched);
}

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

/**
 * Recall relevant entity data for an agent before sending a message.
 * Uses Gemini vector embeddings to find semantically related entities
 * (companies, contacts, deals, products, missions, etc.).
 *
 * Auto-detects entity types from the message to narrow results when the
 * user explicitly mentions a category (e.g. "show me all deals").
 */
export async function recallEntityContext(
  _agentId: string,
  userMessage: string,
  options?: {
    maxResults?: number;
    entityTypes?: EmbeddableEntityType[];
  }
): Promise<string> {
  const { maxResults = 15, entityTypes } = options || {};

  if (!isSupabaseConfigured() || !userMessage.trim()) return '';

  // Auto-detect entity types from the message if none explicitly provided
  const resolvedTypes = entityTypes ?? detectEntityTypes(userMessage);

  try {
    const results = await searchEntities(userMessage, {
      entityTypes: resolvedTypes,
      limit: maxResults,
      threshold: 0.3,
      hybrid: true,
    });

    if (results.length === 0) return '';

    const lines = ['## Relevant Data'];
    if (resolvedTypes) {
      lines[0] += ` (filtered: ${resolvedTypes.join(', ')})`;
    }
    results.forEach((r, i) => {
      const similarity = (r.similarity * 100).toFixed(0);
      // Show first 300 chars of content_text
      const snippet = r.content_text.length > 300
        ? r.content_text.slice(0, 300) + '...'
        : r.content_text;
      lines.push(`${i + 1}. [${r.entity_type}] (${similarity}% match) ${snippet}`);
    });

    return lines.join('\n');
  } catch (err) {
    console.warn('[SemanticRecall] recallEntityContext error (non-blocking):', err);
    return '';
  }
}
