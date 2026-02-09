/**
 * Memory Summarizer
 * Creates structured summaries from agent conversations and daily notes.
 *
 * Runs on a configurable interval (default: after each significant agent interaction).
 * Summaries are stored in the memory_summaries table and embedded for semantic search.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { storeEmbedding } from './embeddingService';
import type { MemorySummary, SummaryDecision, SummaryActionItem, SummaryStats } from '../../types/memoryIntelligence';

interface DailyNoteEntry {
  timestamp: string;
  type: string;
  content: string;
}

interface DailyNote {
  entries: DailyNoteEntry[];
}

/**
 * Create a summary from the agent's recent activity (daily notes + chat messages).
 * This is a client-side summarization -- extracts structure from stored text.
 */
export async function createAgentSummary(
  agentId: string,
  summaryType: 'hourly' | 'daily' | 'weekly',
  periodStart: Date,
  periodEnd: Date
): Promise<MemorySummary | null> {
  if (!isSupabaseConfigured()) return null;

  // 1. Fetch daily notes for the period
  const { data: notes, error: notesError } = await supabase
    .from('daily_notes')
    .select('*')
    .eq('agent_id', agentId)
    .gte('date', periodStart.toISOString().split('T')[0])
    .lte('date', periodEnd.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (notesError) {
    console.error('[MemorySummarizer] fetch notes error:', notesError);
    return null;
  }

  // 2. Collect all entries
  const allEntries: DailyNoteEntry[] = [];
  for (const note of (notes || []) as DailyNote[]) {
    for (const entry of note.entries || []) {
      allEntries.push({
        timestamp: entry.timestamp,
        type: entry.type,
        content: entry.content,
      });
    }
  }

  if (allEntries.length === 0) return null;

  // 3. Extract structured data from entries
  const topics = extractTopics(allEntries);
  const decisions = extractDecisions(allEntries);
  const actionItems = extractActionItems(allEntries);
  const stats = computeStats(allEntries);
  const summaryText = generateSummaryText(agentId, summaryType, topics, decisions, actionItems, stats, periodStart);

  // 4. Store the summary
  const { data: summary, error: insertError } = await supabase
    .from('memory_summaries')
    .insert({
      agent_id: agentId,
      summary_type: summaryType,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      topics,
      decisions,
      action_items: actionItems,
      summary_text: summaryText,
      stats,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[MemorySummarizer] insert summary error:', insertError);
    return null;
  }

  // 5. Embed the summary for semantic recall
  if (summary) {
    await storeEmbedding(
      'mission_output',
      summary.id,
      agentId,
      summaryText,
      { summary_type: summaryType, period: `${periodStart.toISOString()}-${periodEnd.toISOString()}` }
    );
  }

  return summary as MemorySummary;
}

/**
 * Extract topics from entries by finding the most common nouns/phrases.
 */
function extractTopics(entries: DailyNoteEntry[]): string[] {
  const wordFreq = new Map<string, number>();

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'not', 'no', 'so', 'if', 'then', 'than', 'when', 'what',
    'which', 'who', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'only', 'same', 'just', 'also',
    'very', 'about', 'up', 'out', 'into', 'over', 'after', 'before',
    'between', 'under', 'above', 'task', 'agent', 'started', 'completed',
  ]);

  for (const entry of entries) {
    const words = entry.content.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  // Return top 10 topics by frequency
  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Extract decisions from entries of type 'decision'.
 */
function extractDecisions(entries: DailyNoteEntry[]): SummaryDecision[] {
  return entries
    .filter(e => e.type === 'decision')
    .map(e => ({ description: e.content }))
    .slice(0, 10);
}

/**
 * Extract action items from entries -- look for task_started that don't have task_completed.
 */
function extractActionItems(entries: DailyNoteEntry[]): SummaryActionItem[] {
  const started = new Set<string>();
  const completed = new Set<string>();

  for (const entry of entries) {
    if (entry.type === 'task_started') started.add(entry.content);
    if (entry.type === 'task_completed') completed.add(entry.content);
  }

  const items: SummaryActionItem[] = [];
  started.forEach(task => {
    items.push({
      action: task,
      status: completed.has(task) ? 'completed' : 'in_progress',
    });
  });

  return items.slice(0, 15);
}

/**
 * Compute stats from entries.
 */
function computeStats(entries: DailyNoteEntry[]): SummaryStats {
  const stats: SummaryStats = {
    missions_started: 0,
    missions_completed: 0,
  };

  for (const entry of entries) {
    if (entry.type === 'task_started') stats.missions_started = (stats.missions_started || 0) + 1;
    if (entry.type === 'task_completed') stats.missions_completed = (stats.missions_completed || 0) + 1;
  }

  return stats;
}

/**
 * Generate a human-readable summary text.
 */
function generateSummaryText(
  agentId: string,
  summaryType: string,
  topics: string[],
  decisions: SummaryDecision[],
  actionItems: SummaryActionItem[],
  stats: SummaryStats,
  periodStart: Date
): string {
  const lines: string[] = [];
  const dateStr = periodStart.toISOString().split('T')[0];

  lines.push(`### ${summaryType.charAt(0).toUpperCase() + summaryType.slice(1)} Summary -- ${agentId} -- ${dateStr}`);

  if (topics.length > 0) {
    lines.push(`\nTopics: ${topics.join(', ')}`);
  }

  if (decisions.length > 0) {
    lines.push('\nDecisions Made:');
    decisions.forEach(d => lines.push(`-> ${d.description}`));
  }

  const pending = actionItems.filter(a => a.status !== 'completed');
  const done = actionItems.filter(a => a.status === 'completed');

  if (done.length > 0) {
    lines.push('\nCompleted:');
    done.forEach(a => lines.push(`[done] ${a.action}`));
  }

  if (pending.length > 0) {
    lines.push('\nIn Progress:');
    pending.forEach(a => lines.push(`-> ${a.action}`));
  }

  if (stats.missions_started || stats.missions_completed) {
    lines.push(`\nStats: ${stats.missions_started || 0} started | ${stats.missions_completed || 0} completed`);
  }

  return lines.join('\n');
}

/**
 * Create a daily summary for an agent (convenience wrapper).
 * Call this at end-of-day or on a schedule.
 */
export async function createDailySummary(agentId: string): Promise<MemorySummary | null> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  return createAgentSummary(agentId, 'daily', startOfDay, now);
}

/**
 * Create a weekly summary for an agent.
 */
export async function createWeeklySummary(agentId: string): Promise<MemorySummary | null> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return createAgentSummary(agentId, 'weekly', weekAgo, now);
}
