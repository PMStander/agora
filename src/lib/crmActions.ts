/**
 * CRM Action Protocol
 *
 * Agents embed structured CRM action blocks in their chat responses.
 * This module extracts those blocks and dispatches them to the appropriate
 * Supabase CRUD operations, mirroring the A2UI extraction pattern in useA2UI.ts.
 *
 * An agent can include a CRM action in its response like:
 * ```json
 * {"type":"crm_action","action":"create_contact","payload":{...}}
 * ```
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  LifecycleStatus,
  InteractionType,
  InteractionDirection,
  DealStatus,
} from '../types/crm';

// ─── Action Types ────────────────────────────────────────────────────────────

export type CrmActionName =
  | 'create_contact'
  | 'update_contact'
  | 'create_company'
  | 'update_company'
  | 'create_deal'
  | 'update_deal'
  | 'move_deal'
  | 'log_interaction'
  | 'create_order'
  | 'update_order_status'
  | 'assign_agent'
  | 'create_project'
  | 'link_mission';

export interface CrmAction {
  type: 'crm_action';
  action: CrmActionName;
  payload: Record<string, unknown>;
}

export interface CrmActionResult {
  action: CrmActionName;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ─── Typed Payloads ──────────────────────────────────────────────────────────

interface CreateContactPayload {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_id?: string;
  job_title?: string;
  lifecycle_status?: LifecycleStatus;
  lead_source?: string;
  owner_agent_id?: string;
  tags?: string[];
  notes?: string;
}

interface UpdateContactPayload {
  id: string;
  [key: string]: unknown;
}

interface CreateCompanyPayload {
  name: string;
  domain?: string;
  industry?: string;
  website?: string;
  phone?: string;
  owner_agent_id?: string;
  tags?: string[];
  notes?: string;
}

interface UpdateCompanyPayload {
  id: string;
  [key: string]: unknown;
}

interface CreateDealPayload {
  title: string;
  pipeline_id: string;
  stage_id: string;
  amount?: number;
  currency?: string;
  contact_id?: string;
  company_id?: string;
  owner_agent_id?: string;
  priority?: string;
  tags?: string[];
}

interface UpdateDealPayload {
  id: string;
  [key: string]: unknown;
}

interface MoveDealPayload {
  deal_id: string;
  stage_id: string;
}

interface LogInteractionPayload {
  interaction_type: InteractionType;
  subject?: string;
  body?: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  project_id?: string;
  order_id?: string;
  agent_id?: string;
  direction?: InteractionDirection;
  duration_minutes?: number;
}

interface CreateOrderPayload {
  order_number: string;
  order_type?: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  currency?: string;
  owner_agent_id?: string;
  customer_note?: string;
}

interface UpdateOrderStatusPayload {
  id: string;
  status: string;
}

interface AssignAgentPayload {
  agent_id: string;
  entity_type: 'contact' | 'company' | 'deal' | 'project' | 'order';
  entity_id: string;
  role?: 'owner' | 'collaborator' | 'watcher';
}

interface CreateProjectPayload {
  name: string;
  description?: string;
  status?: string;
  deal_id?: string;
  contact_id?: string;
  company_id?: string;
  owner_agent_id?: string;
  budget?: number;
  currency?: string;
  start_date?: string;
  target_end_date?: string;
  tags?: string[];
}

interface LinkMissionPayload {
  project_id: string;
  mission_id: string;
}

// ─── Extraction ──────────────────────────────────────────────────────────────

const CRM_ACTION_REGEX = /\{[^{}]*"type"\s*:\s*"crm_action"[^{}]*\}/g;
const MAX_SCAN_LENGTH = 200_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeCrmAction(value: unknown): CrmAction | null {
  if (!isRecord(value)) return null;
  if (value.type !== 'crm_action') return null;
  if (typeof value.action !== 'string') return null;
  if (!isRecord(value.payload)) return null;

  return {
    type: 'crm_action',
    action: value.action as CrmActionName,
    payload: value.payload,
  };
}

/**
 * Extract CRM action blocks from an agent's chat response text.
 * Scans for JSON objects containing `"type":"crm_action"`.
 */
export function extractCrmActions(text: string): CrmAction[] {
  if (!text || text.length > MAX_SCAN_LENGTH) return [];
  if (!text.includes('crm_action')) return [];

  const actions: CrmAction[] = [];
  const seen = new Set<string>();

  // Try each regex match
  const matches = text.matchAll(CRM_ACTION_REGEX);
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[0]);
      const action = normalizeCrmAction(parsed);
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
    if (depth === 0 && trimmed.startsWith('{') && trimmed.includes('crm_action')) {
      buffer = '';
      depth = 0;
    }

    if (depth > 0 || (trimmed.startsWith('{') && trimmed.includes('crm_action'))) {
      buffer += trimmed;
      for (const ch of trimmed) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }

      if (depth === 0 && buffer) {
        try {
          const parsed = JSON.parse(buffer);
          const action = normalizeCrmAction(parsed);
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
 * Execute a single CRM action against Supabase.
 */
export async function executeCrmAction(action: CrmAction): Promise<CrmActionResult> {
  if (!isSupabaseConfigured()) {
    return { action: action.action, success: false, error: 'Supabase not configured' };
  }

  try {
    switch (action.action) {
      case 'create_contact': {
        const p = action.payload as unknown as CreateContactPayload;
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            phone: p.phone,
            company_id: p.company_id,
            job_title: p.job_title,
            lifecycle_status: p.lifecycle_status ?? 'lead',
            lead_source: p.lead_source,
            owner_agent_id: p.owner_agent_id,
            tags: p.tags ?? [],
            notes: p.notes,
          })
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'update_contact': {
        const p = action.payload as unknown as UpdateContactPayload;
        const { id, ...updates } = p;
        const { data, error } = await supabase
          .from('contacts')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'create_company': {
        const p = action.payload as unknown as CreateCompanyPayload;
        const { data, error } = await supabase
          .from('companies')
          .insert({
            name: p.name,
            domain: p.domain,
            industry: p.industry,
            website: p.website,
            phone: p.phone,
            owner_agent_id: p.owner_agent_id,
            tags: p.tags ?? [],
            notes: p.notes,
          })
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'update_company': {
        const p = action.payload as unknown as UpdateCompanyPayload;
        const { id, ...updates } = p;
        const { data, error } = await supabase
          .from('companies')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'create_deal': {
        const p = action.payload as unknown as CreateDealPayload;
        const { data, error } = await supabase
          .from('deals')
          .insert({
            title: p.title,
            pipeline_id: p.pipeline_id,
            stage_id: p.stage_id,
            amount: p.amount,
            currency: p.currency ?? 'USD',
            contact_id: p.contact_id,
            company_id: p.company_id,
            owner_agent_id: p.owner_agent_id,
            priority: p.priority ?? 'medium',
            tags: p.tags ?? [],
          })
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'update_deal': {
        const p = action.payload as unknown as UpdateDealPayload;
        const { id, ...updates } = p;
        const { data, error } = await supabase
          .from('deals')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'move_deal': {
        const p = action.payload as unknown as MoveDealPayload;

        // Look up the target stage to check if it's terminal
        const { data: stage } = await supabase
          .from('pipeline_stages')
          .select('is_won, is_lost')
          .eq('id', p.stage_id)
          .single();

        const statusUpdates: Record<string, unknown> = {
          stage_id: p.stage_id,
          updated_at: new Date().toISOString(),
        };

        if (stage?.is_won) {
          statusUpdates.status = 'won' as DealStatus;
          statusUpdates.close_date = new Date().toISOString();
        } else if (stage?.is_lost) {
          statusUpdates.status = 'lost' as DealStatus;
          statusUpdates.close_date = new Date().toISOString();
        }

        const { data, error } = await supabase
          .from('deals')
          .update(statusUpdates)
          .eq('id', p.deal_id)
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'log_interaction': {
        const p = action.payload as unknown as LogInteractionPayload;
        const { data, error } = await supabase
          .from('crm_interactions')
          .insert({
            interaction_type: p.interaction_type,
            subject: p.subject,
            body: p.body,
            contact_id: p.contact_id,
            company_id: p.company_id,
            deal_id: p.deal_id,
            project_id: p.project_id,
            order_id: p.order_id,
            agent_id: p.agent_id,
            direction: p.direction,
            duration_minutes: p.duration_minutes,
          })
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'create_order': {
        const p = action.payload as unknown as CreateOrderPayload;
        const { data, error } = await supabase
          .from('orders')
          .insert({
            order_number: p.order_number,
            order_type: p.order_type ?? 'order',
            contact_id: p.contact_id,
            company_id: p.company_id,
            deal_id: p.deal_id,
            currency: p.currency ?? 'USD',
            owner_agent_id: p.owner_agent_id,
            customer_note: p.customer_note,
          })
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'update_order_status': {
        const p = action.payload as unknown as UpdateOrderStatusPayload;
        const { data, error } = await supabase
          .from('orders')
          .update({ status: p.status, updated_at: new Date().toISOString() })
          .eq('id', p.id)
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'assign_agent': {
        const p = action.payload as unknown as AssignAgentPayload;
        const { data, error } = await supabase
          .from('crm_agent_assignments')
          .upsert(
            {
              agent_id: p.agent_id,
              entity_type: p.entity_type,
              entity_id: p.entity_id,
              role: p.role ?? 'owner',
            },
            { onConflict: 'agent_id,entity_type,entity_id' }
          )
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'create_project': {
        const p = action.payload as unknown as CreateProjectPayload;
        const { data, error } = await supabase
          .from('projects')
          .insert({
            name: p.name,
            description: p.description,
            status: p.status ?? 'planning',
            deal_id: p.deal_id,
            contact_id: p.contact_id,
            company_id: p.company_id,
            owner_agent_id: p.owner_agent_id,
            budget: p.budget,
            currency: p.currency ?? 'USD',
            start_date: p.start_date,
            target_end_date: p.target_end_date,
            tags: p.tags ?? [],
          })
          .select()
          .single();
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true, data: data as Record<string, unknown> };
      }

      case 'link_mission': {
        const p = action.payload as unknown as LinkMissionPayload;
        const { error } = await supabase
          .from('project_missions')
          .insert({ project_id: p.project_id, mission_id: p.mission_id });
        if (error) return { action: action.action, success: false, error: error.message };
        return { action: action.action, success: true };
      }

      default:
        return {
          action: action.action,
          success: false,
          error: `Unknown CRM action: ${action.action}`,
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
 * Process all CRM actions found in an agent response.
 * Returns results for each action executed.
 */
export async function processCrmActions(text: string): Promise<CrmActionResult[]> {
  const actions = extractCrmActions(text);
  if (actions.length === 0) return [];

  console.log(`[CRM Actions] Found ${actions.length} action(s):`, actions.map((a) => a.action));

  const results: CrmActionResult[] = [];
  for (const action of actions) {
    const result = await executeCrmAction(action);
    if (!result.success) {
      console.error(`[CRM Actions] ${action.action} failed:`, result.error);
    } else {
      console.log(`[CRM Actions] ${action.action} succeeded`);
    }
    results.push(result);
  }

  return results;
}

// ─── Agent CRM Context Builder ───────────────────────────────────────────────

export interface CrmContext {
  contact?: { name: string; company?: string; lifecycle_status?: string; email?: string };
  deal?: { title: string; stage?: string; amount?: number; close_date?: string };
  project?: { name: string; status?: string; progress?: number };
}

/**
 * Build a CRM context string to inject into agent prompts when a mission
 * is linked to CRM entities.
 */
export function buildCrmContextPrompt(ctx: CrmContext): string {
  const parts: string[] = [];

  if (ctx.contact) {
    let contactLine = `Contact: ${ctx.contact.name}`;
    if (ctx.contact.company) contactLine += ` (${ctx.contact.company})`;
    if (ctx.contact.lifecycle_status) contactLine += ` [${ctx.contact.lifecycle_status}]`;
    if (ctx.contact.email) contactLine += ` <${ctx.contact.email}>`;
    parts.push(contactLine);
  }

  if (ctx.deal) {
    let dealLine = `Deal: ${ctx.deal.title}`;
    if (ctx.deal.amount != null) dealLine += ` — $${ctx.deal.amount.toLocaleString()}`;
    if (ctx.deal.stage) dealLine += ` (${ctx.deal.stage})`;
    if (ctx.deal.close_date) dealLine += ` close: ${ctx.deal.close_date}`;
    parts.push(dealLine);
  }

  if (ctx.project) {
    let projectLine = `Project: ${ctx.project.name}`;
    if (ctx.project.status) projectLine += ` [${ctx.project.status}]`;
    if (ctx.project.progress != null) projectLine += ` ${ctx.project.progress}% complete`;
    parts.push(projectLine);
  }

  if (parts.length === 0) return '';
  return `\n--- CRM Context ---\n${parts.join('\n')}\n-------------------\n`;
}
