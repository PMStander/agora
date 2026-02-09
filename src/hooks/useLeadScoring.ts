import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useCrmStore } from '../stores/crm';
import type {
  Contact,
  LeadScoreLabel,
  LeadScoringModel,
  LeadScoringRule,
  LeadScoreHistoryEntry,
} from '../types/crm';

// ─── Default rules (used when no model in DB) ──────────────────────────────

const DEFAULT_THRESHOLDS = { hot: 80, warm: 50, cold: 20 };

const DEFAULT_RULES: LeadScoringRule[] = [
  { id: 'r1', type: 'field_exists', field: 'email', points: 10, label: 'Has email' },
  { id: 'r2', type: 'field_exists', field: 'phone', points: 10, label: 'Has phone' },
  { id: 'r3', type: 'field_value', field: 'lifecycle_status', operator: 'eq', value: 'customer', points: 30, label: 'Is customer' },
  { id: 'r4', type: 'field_value', field: 'lifecycle_status', operator: 'eq', value: 'sales_qualified', points: 20, label: 'Sales qualified' },
  { id: 'r5', type: 'field_value', field: 'lifecycle_status', operator: 'eq', value: 'marketing_qualified', points: 15, label: 'Marketing qualified' },
  { id: 'r6', type: 'field_value', field: 'lifecycle_status', operator: 'eq', value: 'opportunity', points: 25, label: 'Is opportunity' },
  { id: 'r7', type: 'has_deal', points: 20, label: 'Has open deal' },
  { id: 'r8', type: 'field_exists', field: 'company_id', points: 5, label: 'Linked to company' },
  { id: 'r9', type: 'field_exists', field: 'lead_source', points: 5, label: 'Has lead source' },
  { id: 'r10', type: 'last_interaction_within', value: 7, points: 15, label: 'Contacted within 7 days' },
  { id: 'r11', type: 'last_interaction_within', value: 30, points: 5, label: 'Contacted within 30 days' },
];

// ─── Score evaluation ───────────────────────────────────────────────────────

function evaluateRule(
  rule: LeadScoringRule,
  contact: Contact,
  deals: { contact_id: string | null; status: string }[],
  interactions: { contact_id: string | null; created_at: string }[]
): boolean {
  switch (rule.type) {
    case 'field_exists': {
      if (!rule.field) return false;
      const val = (contact as unknown as Record<string, unknown>)[rule.field];
      return val !== null && val !== undefined && val !== '' && val !== 0;
    }

    case 'field_value': {
      if (!rule.field || !rule.operator) return false;
      const val = (contact as unknown as Record<string, unknown>)[rule.field];
      switch (rule.operator) {
        case 'eq': return val === rule.value;
        case 'neq': return val !== rule.value;
        case 'gt': return typeof val === 'number' && typeof rule.value === 'number' && val > rule.value;
        case 'lt': return typeof val === 'number' && typeof rule.value === 'number' && val < rule.value;
        case 'gte': return typeof val === 'number' && typeof rule.value === 'number' && val >= rule.value;
        case 'lte': return typeof val === 'number' && typeof rule.value === 'number' && val <= rule.value;
        case 'contains':
          return typeof val === 'string' && typeof rule.value === 'string' && val.toLowerCase().includes(rule.value.toLowerCase());
        default: return false;
      }
    }

    case 'has_deal': {
      return deals.some((d) => d.contact_id === contact.id && d.status === 'open');
    }

    case 'interaction_count_30d': {
      const thirtyDaysAgo = Date.now() - 30 * 86400000;
      const count = interactions.filter(
        (i) => i.contact_id === contact.id && new Date(i.created_at).getTime() > thirtyDaysAgo
      ).length;
      if (!rule.operator || !rule.value) return count > 0;
      const target = Number(rule.value);
      switch (rule.operator) {
        case 'gt': return count > target;
        case 'gte': return count >= target;
        case 'lt': return count < target;
        case 'lte': return count <= target;
        case 'eq': return count === target;
        default: return count > 0;
      }
    }

    case 'last_interaction_within': {
      if (!contact.last_contacted_at) return false;
      const days = typeof rule.value === 'number' ? rule.value : 30;
      const cutoff = Date.now() - days * 86400000;
      return new Date(contact.last_contacted_at).getTime() > cutoff;
    }

    default:
      return false;
  }
}

function labelFromScore(score: number, thresholds: { hot: number; warm: number; cold: number }): LeadScoreLabel {
  if (score >= thresholds.hot) return 'hot';
  if (score >= thresholds.warm) return 'warm';
  return 'cold';
}

export interface ScoreBreakdown {
  total: number;
  label: LeadScoreLabel;
  items: { ruleLabel: string; points: number; matched: boolean }[];
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLeadScoring() {
  const initializedRef = useRef(false);
  const [activeModel, setActiveModel] = useState<LeadScoringModel | null>(null);
  const [history, setHistory] = useState<LeadScoreHistoryEntry[]>([]);

  const store = useCrmStore();

  // Fetch active scoring model on mount
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    supabase
      .from('lead_scoring_models')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setActiveModel(data as LeadScoringModel);
      });
  }, []);

  const rules = activeModel?.rules ?? DEFAULT_RULES;
  const thresholds = activeModel?.score_thresholds ?? DEFAULT_THRESHOLDS;

  // Compute score for a single contact
  const computeScore = useCallback(
    (contact: Contact): ScoreBreakdown => {
      const deals = store.deals;
      const interactions = store.interactions;

      const items = rules.map((rule) => {
        const matched = evaluateRule(rule, contact, deals, interactions);
        return { ruleLabel: rule.label, points: rule.points, matched };
      });

      const total = Math.min(
        100,
        items.reduce((sum, item) => sum + (item.matched ? item.points : 0), 0)
      );

      return {
        total,
        label: labelFromScore(total, thresholds),
        items,
      };
    },
    [rules, thresholds, store.deals, store.interactions]
  );

  // Recalculate score for a single contact and persist
  const recalculateScore = useCallback(
    async (contact: Contact) => {
      const breakdown = computeScore(contact);

      // Update local store
      store.updateContact(contact.id, {
        lead_score: breakdown.total,
        lead_score_label: breakdown.label,
        lead_score_updated_at: new Date().toISOString(),
      });

      if (!isSupabaseConfigured()) return breakdown;

      // Persist to contacts table
      await supabase
        .from('contacts')
        .update({
          lead_score: breakdown.total,
          lead_score_label: breakdown.label,
          lead_score_updated_at: new Date().toISOString(),
        })
        .eq('id', contact.id);

      // Write history entry
      const breakdownMap: Record<string, number> = {};
      breakdown.items
        .filter((i) => i.matched)
        .forEach((i) => { breakdownMap[i.ruleLabel] = i.points; });

      await supabase.from('lead_score_history').insert({
        contact_id: contact.id,
        score: breakdown.total,
        label: breakdown.label,
        source: 'auto',
        model_id: activeModel?.id ?? null,
        breakdown: breakdownMap,
      });

      return breakdown;
    },
    [computeScore, activeModel, store]
  );

  // Recalculate all contacts
  const recalculateAllScores = useCallback(async () => {
    const contacts = store.contacts;
    for (const contact of contacts) {
      await recalculateScore(contact);
    }
  }, [store.contacts, recalculateScore]);

  // Manual override
  const overrideScore = useCallback(
    async (contactId: string, score: number, label: LeadScoreLabel) => {
      store.updateContact(contactId, {
        lead_score: score,
        lead_score_label: label,
        lead_score_updated_at: new Date().toISOString(),
      });

      if (!isSupabaseConfigured()) return;

      await supabase
        .from('contacts')
        .update({
          lead_score: score,
          lead_score_label: label,
          lead_score_updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      await supabase.from('lead_score_history').insert({
        contact_id: contactId,
        score,
        label,
        source: 'manual',
        breakdown: { manual_override: score },
      });
    },
    [store]
  );

  // Fetch history for a specific contact
  const fetchHistory = useCallback(async (contactId: string) => {
    if (!isSupabaseConfigured()) return;
    const { data, error } = await supabase
      .from('lead_score_history')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setHistory(data as LeadScoreHistoryEntry[]);
    }
  }, []);

  return {
    activeModel,
    computeScore,
    recalculateScore,
    recalculateAllScores,
    overrideScore,
    fetchHistory,
    history,
  };
}
