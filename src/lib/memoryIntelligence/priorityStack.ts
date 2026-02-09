/**
 * Shared Priority Stack
 * A single source of truth for what matters now, readable by all agents.
 *
 * Updated by:
 * - User (via chat commands or UI)
 * - Boardroom sessions (standup/strategy outcomes)
 * - Agent recommendations (with user approval)
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import type { SharedPriority, PriorityScope } from '../../types/memoryIntelligence';

/**
 * Get active priorities, optionally filtered by scope.
 */
export async function getPriorities(
  scope?: PriorityScope,
  scopeTarget?: string
): Promise<SharedPriority[]> {
  if (!isSupabaseConfigured()) return [];

  let q = supabase
    .from('shared_priorities')
    .select('*')
    .eq('status', 'active')
    .order('priority_rank', { ascending: true });

  if (scope) {
    q = q.eq('scope', scope);
  }
  if (scopeTarget) {
    q = q.eq('scope_target', scopeTarget);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[PriorityStack] getPriorities error:', error);
    return [];
  }

  return (data || []) as SharedPriority[];
}

/**
 * Get all applicable priorities for a specific agent.
 * Returns global + their team + agent-specific priorities.
 */
export async function getAgentPriorities(
  agentId: string,
  teamId?: string
): Promise<SharedPriority[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('shared_priorities')
    .select('*')
    .eq('status', 'active')
    .order('priority_rank', { ascending: true });

  if (error) {
    console.error('[PriorityStack] getAgentPriorities error:', error);
    return [];
  }

  // Filter: global OR matching team OR matching agent
  return ((data || []) as SharedPriority[]).filter(p => {
    if (p.scope === 'global') return true;
    if (p.scope === 'team' && teamId && p.scope_target === teamId) return true;
    if (p.scope === 'agent' && p.scope_target === agentId) return true;
    return false;
  });
}

/**
 * Set a new priority. Automatically assigns the next rank.
 */
export async function setPriority(
  title: string,
  description?: string,
  scope: PriorityScope = 'global',
  scopeTarget?: string,
  setBy: string = 'user'
): Promise<SharedPriority | null> {
  if (!isSupabaseConfigured()) return null;

  // Get max rank for this scope
  const { data: existing } = await supabase
    .from('shared_priorities')
    .select('priority_rank')
    .eq('status', 'active')
    .eq('scope', scope)
    .order('priority_rank', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextRank = (existing?.priority_rank || 0) + 1;

  const { data, error } = await supabase
    .from('shared_priorities')
    .insert({
      priority_rank: nextRank,
      title,
      description: description || null,
      set_by: setBy,
      scope,
      scope_target: scopeTarget || null,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('[PriorityStack] setPriority error:', error);
    return null;
  }

  return data as SharedPriority;
}

/**
 * Reorder priorities by providing an ordered array of IDs.
 */
export async function reorderPriorities(orderedIds: string[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const updates = orderedIds.map((id, index) =>
    supabase
      .from('shared_priorities')
      .update({ priority_rank: index + 1, updated_at: new Date().toISOString() })
      .eq('id', id)
  );

  const results = await Promise.all(updates);
  const hasError = results.some(r => r.error);

  if (hasError) {
    console.error('[PriorityStack] reorderPriorities: some updates failed');
  }

  return !hasError;
}

/**
 * Complete (close) a priority.
 */
export async function completePriority(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('shared_priorities')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[PriorityStack] completePriority error:', error);
    return false;
  }

  return true;
}

/**
 * Format priorities as a readable string for agent context injection.
 */
export function formatPrioritiesForAgent(priorities: SharedPriority[]): string {
  if (priorities.length === 0) return '';

  const lines: string[] = ['## Current Priorities'];

  const global = priorities.filter(p => p.scope === 'global');
  const team = priorities.filter(p => p.scope === 'team');
  const agent = priorities.filter(p => p.scope === 'agent');

  if (global.length > 0) {
    global.forEach((p, i) => {
      lines.push(`${i + 1}. **${p.title}**${p.description ? ` -- ${p.description}` : ''}`);
    });
  }

  if (team.length > 0) {
    lines.push('\n### Team Priorities');
    team.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.title}${p.description ? ` -- ${p.description}` : ''}`);
    });
  }

  if (agent.length > 0) {
    lines.push('\n### Your Priorities');
    agent.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.title}${p.description ? ` -- ${p.description}` : ''}`);
    });
  }

  return lines.join('\n');
}
