import { useCallback, useRef, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useContextStore } from '../stores/context';
import type {
  DailyNote,
  DailyNoteEntry,
  LongTermMemory,
  CrossProjectInsight,
} from '../types/context';

export function useAgentMemory() {
  const { dailyNotes, setDailyNotes, appendDailyNoteEntry } = useContextStore();
  const initializedRef = useRef(false);

  // ── Realtime subscription for daily notes ─────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    const channel = supabase
      .channel('daily-notes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_notes' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const note = payload.new as DailyNote;
            const store = useContextStore.getState();
            const existing = store.dailyNotes[note.agent_id] || [];
            const idx = existing.findIndex((n) => n.id === note.id);
            if (idx >= 0) {
              const updated = [...existing];
              updated[idx] = note;
              store.setDailyNotes(note.agent_id, updated);
            } else {
              store.setDailyNotes(note.agent_id, [note, ...existing]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // ── Get daily notes ───────────────────────────────────────────────────
  const getDailyNotes = useCallback(
    async (
      agentId: string,
      dateRange?: { from: string; to: string }
    ): Promise<DailyNote[]> => {
      if (!isSupabaseConfigured()) return dailyNotes[agentId] || [];

      let q = supabase
        .from('daily_notes')
        .select('*')
        .eq('agent_id', agentId)
        .order('date', { ascending: false });

      if (dateRange) {
        q = q.gte('date', dateRange.from).lte('date', dateRange.to);
      } else {
        // Default to last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
          .toISOString()
          .split('T')[0];
        q = q.gte('date', thirtyDaysAgo);
      }

      const { data, error } = await q;
      if (error) {
        console.error('[AgentMemory] getDailyNotes error:', error);
        return [];
      }

      const notes = (data || []) as DailyNote[];
      setDailyNotes(agentId, notes);
      return notes;
    },
    [dailyNotes, setDailyNotes]
  );

  // ── Append daily note entry ───────────────────────────────────────────
  const appendDailyNote = useCallback(
    async (agentId: string, entry: DailyNoteEntry) => {
      const today = new Date().toISOString().split('T')[0];

      // Optimistic update
      appendDailyNoteEntry(agentId, today, entry);

      if (!isSupabaseConfigured()) return;

      // Upsert: get today's note or create one
      const { data: existing } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('agent_id', agentId)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        const updatedEntries = [...(existing.entries || []), entry];
        await supabase
          .from('daily_notes')
          .update({
            entries: updatedEntries,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('daily_notes').insert({
          agent_id: agentId,
          date: today,
          entries: [entry],
        });
      }
    },
    [appendDailyNoteEntry]
  );

  // ── Get long-term memories ────────────────────────────────────────────
  const getLongTermMemories = useCallback(
    async (
      agentId: string,
      filters?: {
        category?: string;
        tag?: string;
        minRelevance?: number;
      }
    ): Promise<LongTermMemory[]> => {
      if (!isSupabaseConfigured()) return [];

      let q = supabase
        .from('long_term_memories')
        .select('*')
        .eq('agent_id', agentId)
        .order('relevance_score', { ascending: false });

      if (filters?.category) {
        q = q.eq('category', filters.category);
      }
      if (filters?.tag) {
        q = q.contains('tags', [filters.tag]);
      }
      if (filters?.minRelevance !== undefined) {
        q = q.gte('relevance_score', filters.minRelevance);
      }

      const { data, error } = await q;
      if (error) {
        console.error('[AgentMemory] getLongTermMemories error:', error);
        return [];
      }
      return (data || []) as LongTermMemory[];
    },
    []
  );

  // ── Promote daily note entry to long-term memory ──────────────────────
  const promoteToLongTerm = useCallback(
    async (
      agentId: string,
      category: LongTermMemory['category'],
      title: string,
      content: string,
      sourceDailyNoteId?: string,
      sourceTaskId?: string
    ): Promise<LongTermMemory | null> => {
      if (!isSupabaseConfigured()) return null;

      const { data, error } = await supabase
        .from('long_term_memories')
        .insert({
          agent_id: agentId,
          category,
          title,
          content,
          source_daily_note_id: sourceDailyNoteId || null,
          source_task_id: sourceTaskId || null,
          relevance_score: 1.0,
          tags: [],
        })
        .select()
        .single();

      if (error) {
        console.error('[AgentMemory] promoteToLongTerm error:', error);
        return null;
      }
      return data as LongTermMemory;
    },
    []
  );

  // ── Flag cross-project insight ────────────────────────────────────────
  const flagCrossProjectInsight = useCallback(
    async (
      sourceAgentId: string,
      sourceProjectContextId: string,
      insight: string,
      applicableDomains: string[]
    ): Promise<CrossProjectInsight | null> => {
      if (!isSupabaseConfigured()) return null;

      const { data, error } = await supabase
        .from('cross_project_insights')
        .insert({
          source_agent_id: sourceAgentId,
          source_project_context_id: sourceProjectContextId,
          insight,
          applicable_domains: applicableDomains,
          propagated_to: [],
        })
        .select()
        .single();

      if (error) {
        console.error('[AgentMemory] flagCrossProjectInsight error:', error);
        return null;
      }
      return data as CrossProjectInsight;
    },
    []
  );

  // ── Decay relevance scores ────────────────────────────────────────────
  const decayRelevanceScores = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase.rpc('decay_memory_relevance');
    if (error) {
      // Fallback: manually update
      console.error('[AgentMemory] decay RPC error, using fallback:', error);
      await supabase
        .from('long_term_memories')
        .update({ relevance_score: 0 })
        .lt('relevance_score', 0.05);
    }
  }, []);

  return {
    dailyNotes,
    getDailyNotes,
    appendDailyNote,
    getLongTermMemories,
    promoteToLongTerm,
    flagCrossProjectInsight,
    decayRelevanceScores,
  };
}
