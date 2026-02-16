/**
 * Growth Action Protocol
 *
 * Agents embed structured growth action blocks in their chat responses
 * when performing self-reflection. This module extracts those blocks and
 * stores them in the `agent_reflections` Supabase table, mirroring the
 * CRM action extraction pattern in crmActions.ts.
 *
 * An agent can include a growth action in its response like:
 * ```json
 * {"type":"growth_action","action":"log_reflection","payload":{...}}
 * ```
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { createNotificationDirect } from '../hooks/useNotifications';

// ─── Action Types ────────────────────────────────────────────────────────────

export type GrowthActionName = 'log_reflection';

export interface GrowthAction {
  type: 'growth_action';
  action: GrowthActionName;
  payload: Record<string, unknown>;
}

export interface GrowthActionResult {
  action: GrowthActionName;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ─── Typed Payloads ──────────────────────────────────────────────────────────

interface LogReflectionPayload {
  /** Agent ID (will be injected if missing) */
  agent_id?: string;
  /** What triggered this reflection */
  trigger: 'post_task' | 'post_session' | 'daily' | 'manual';
  /** Overall sentiment */
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  /** Categorization tags (e.g. "error-handling", "communication", "tooling") */
  tags: string[];
  /** The reflection content / narrative */
  content: string;
  /** Specific lessons the agent learned */
  lessons_learned?: string[];
  /** Areas the agent identified for improvement */
  areas_for_improvement?: string[];
  /** Agent's confidence in this reflection (0-1) */
  confidence_score?: number;
  /** Optional mission context */
  source_mission_id?: string;
  /** Optional session context */
  source_session_id?: string;
}

// ─── Extraction ──────────────────────────────────────────────────────────────

const GROWTH_ACTION_REGEX = /\{[^{}]*"type"\s*:\s*"growth_action"[^{}]*\}/g;
const MAX_SCAN_LENGTH = 200_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeGrowthAction(value: unknown): GrowthAction | null {
  if (!isRecord(value)) return null;
  if (value.type !== 'growth_action') return null;
  if (typeof value.action !== 'string') return null;
  if (!isRecord(value.payload)) return null;

  return {
    type: 'growth_action',
    action: value.action as GrowthActionName,
    payload: value.payload,
  };
}

/**
 * Extract growth action blocks from an agent's chat response text.
 * Scans for JSON objects containing `"type":"growth_action"`.
 */
export function extractGrowthActions(text: string): GrowthAction[] {
  if (!text || text.length > MAX_SCAN_LENGTH) return [];
  if (!text.includes('growth_action')) return [];

  const actions: GrowthAction[] = [];
  const seen = new Set<string>();

  // Try each regex match (single-line JSON)
  const matches = text.matchAll(GROWTH_ACTION_REGEX);
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[0]);
      const action = normalizeGrowthAction(parsed);
      if (action) {
        const key = `${action.action}:${JSON.stringify(action.payload)}`;
        if (!seen.has(key)) {
          seen.add(key);
          actions.push(action);
        }
      }
    } catch {
      // Ignore malformed JSON — scan continues
    }
  }

  // Also try line-by-line for multi-line JSON blocks (e.g. in code fences)
  const lines = text.split(/\r?\n/);
  let buffer = '';
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (depth === 0 && trimmed.startsWith('{') && trimmed.includes('growth_action')) {
      buffer = '';
      depth = 0;
    }

    if (depth > 0 || (trimmed.startsWith('{') && trimmed.includes('growth_action'))) {
      buffer += trimmed;
      for (const ch of trimmed) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }

      if (depth === 0 && buffer) {
        try {
          const parsed = JSON.parse(buffer);
          const action = normalizeGrowthAction(parsed);
          if (action) {
            const key = `${action.action}:${JSON.stringify(action.payload)}`;
            if (!seen.has(key)) {
              seen.add(key);
              actions.push(action);
            }
          }
        } catch {
          // Ignore
        }
        buffer = '';
      }
    }
  }

  return actions;
}

// ─── Execution ───────────────────────────────────────────────────────────────

/**
 * Execute a single growth action against Supabase.
 */
export async function executeGrowthAction(
  action: GrowthAction,
  sourceAgentId: string,
): Promise<GrowthActionResult> {
  if (!isSupabaseConfigured()) {
    return { action: action.action, success: false, error: 'Supabase not configured' };
  }

  try {
    switch (action.action) {
      case 'log_reflection': {
        const p = action.payload as unknown as LogReflectionPayload;
        const agentId = p.agent_id || sourceAgentId;

        // Validate required fields
        if (!p.content || !p.trigger || !p.sentiment) {
          return {
            action: action.action,
            success: false,
            error: 'Missing required fields: content, trigger, sentiment',
          };
        }

        const { data, error } = await supabase
          .from('agent_reflections')
          .insert({
            agent_id: agentId,
            trigger: p.trigger,
            sentiment: p.sentiment,
            tags: p.tags ?? [],
            content: p.content,
            lessons_learned: p.lessons_learned ?? [],
            areas_for_improvement: p.areas_for_improvement ?? [],
            confidence_score: p.confidence_score ?? 0.5,
            source_mission_id: p.source_mission_id,
            source_session_id: p.source_session_id,
          })
          .select()
          .single();

        if (error) return { action: action.action, success: false, error: error.message };

        // Fire notification
        createNotificationDirect(
          'agent_reflection',
          `${agentId} reflected`,
          `New ${p.trigger} reflection: ${p.content.slice(0, 80)}${p.content.length > 80 ? '…' : ''}`,
          'agent',
          agentId,
          agentId,
          'info',
        );

        // Pattern detection: check for repeated tags in last 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        for (const tag of p.tags ?? []) {
          const { count } = await supabase
            .from('agent_reflections')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', agentId)
            .contains('tags', [tag])
            .gte('created_at', oneDayAgo);

          if (count && count >= 3) {
            createNotificationDirect(
              'reflection_pattern',
              `Recurring pattern: "${tag}"`,
              `${agentId} has reflected on "${tag}" ${count} times in the last 24 hours. This may indicate a systemic issue.`,
              'agent',
              agentId,
              agentId,
              'warning',
            );
          }
        }

        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      default:
        return {
          action: action.action,
          success: false,
          error: `Unknown growth action: ${action.action}`,
        };
    }
  } catch (err) {
    return {
      action: action.action,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Process all growth actions found in an agent response.
 * Returns results for each action executed.
 */
export async function processGrowthActions(
  text: string,
  sourceAgentId: string,
): Promise<GrowthActionResult[]> {
  const actions = extractGrowthActions(text);
  if (actions.length === 0) return [];

  console.log(`[Growth Actions] Found ${actions.length} action(s) from ${sourceAgentId}:`, actions.map((a) => a.action));

  const results: GrowthActionResult[] = [];
  for (const action of actions) {
    const result = await executeGrowthAction(action, sourceAgentId);
    if (!result.success) {
      console.error(`[Growth Actions] ${action.action} failed:`, result.error);
    } else {
      console.log(`[Growth Actions] ${action.action} succeeded for ${sourceAgentId}`);
    }
    results.push(result);
  }

  return results;
}
