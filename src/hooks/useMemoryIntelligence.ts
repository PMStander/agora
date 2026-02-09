/**
 * useMemoryIntelligence Hook
 *
 * Provides the Memory Intelligence system to React components:
 * - Semantic recall for agent context enrichment
 * - Feedback pattern extraction and learning
 * - Shared priority stack management
 * - Memory summarization
 * - Auto-embedding of new content
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  semanticSearch,
  storeEmbedding,
} from '../lib/memoryIntelligence/embeddingService';
import { recallContextForAgent } from '../lib/memoryIntelligence/semanticRecall';
import { createDailySummary, createWeeklySummary } from '../lib/memoryIntelligence/memorySummarizer';
import { extractFeedbackPatterns, recordAgentFeedback, getAgentMistakes } from '../lib/memoryIntelligence/feedbackPatterns';
import {
  getPriorities,
  getAgentPriorities,
  setPriority,
  reorderPriorities,
  completePriority,
  formatPrioritiesForAgent,
} from '../lib/memoryIntelligence/priorityStack';
import type {
  SemanticSearchResult,
  SemanticSearchOptions,
  SharedPriority,
  AgentLearnedPattern,
  MemorySummary,
  EmbeddingSourceType,
  PriorityScope,
} from '../types/memoryIntelligence';
import type { RecalledContext } from '../lib/memoryIntelligence/semanticRecall';

export interface UseMemoryIntelligenceReturn {
  // Semantic Search
  search: (query: string, options?: SemanticSearchOptions) => Promise<SemanticSearchResult[]>;
  recallContext: (agentId: string, message: string) => Promise<RecalledContext>;

  // Embedding
  embed: (sourceType: EmbeddingSourceType, sourceId: string, agentId: string, text: string) => Promise<boolean>;

  // Priorities
  priorities: SharedPriority[];
  loadPriorities: (scope?: PriorityScope, scopeTarget?: string) => Promise<void>;
  addPriority: (title: string, description?: string, scope?: PriorityScope, scopeTarget?: string) => Promise<SharedPriority | null>;
  removePriority: (id: string) => Promise<boolean>;
  reorder: (orderedIds: string[]) => Promise<boolean>;
  priorityContextForAgent: (agentId: string, teamId?: string) => Promise<string>;

  // Feedback & Learning
  patterns: AgentLearnedPattern[];
  loadPatterns: (agentId: string) => Promise<void>;
  extractPatterns: (agentId: string) => Promise<AgentLearnedPattern[]>;
  recordFeedback: (agentId: string, action: 'approved' | 'rejected' | 'revised', context: string, reason?: string) => Promise<void>;
  getMistakes: (agentId: string) => Promise<AgentLearnedPattern[]>;

  // Summarization
  createDailySummaryForAgent: (agentId: string) => Promise<MemorySummary | null>;
  createWeeklySummaryForAgent: (agentId: string) => Promise<MemorySummary | null>;

  // State
  isLoading: boolean;
}

export function useMemoryIntelligence(): UseMemoryIntelligenceReturn {
  const [priorities, setPrioritiesState] = useState<SharedPriority[]>([]);
  const [patterns, setPatternsState] = useState<AgentLearnedPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const initializedRef = useRef(false);

  // ── Realtime subscription for priorities ─────────────────────────────
  const loadPrioritiesInternal = useCallback(async (scope?: PriorityScope, scopeTarget?: string) => {
    const data = await getPriorities(scope, scopeTarget);
    setPrioritiesState(data);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    const channel = supabase
      .channel('priorities-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shared_priorities' },
        () => {
          // Reload priorities on any change
          loadPrioritiesInternal();
        }
      )
      .subscribe();

    // Initial load
    loadPrioritiesInternal();

    return () => {
      channel.unsubscribe();
    };
  }, [loadPrioritiesInternal]);

  // ── Semantic Search ──────────────────────────────────────────────────
  const search = useCallback(async (query: string, options?: SemanticSearchOptions) => {
    setIsLoading(true);
    try {
      return await semanticSearch(query, options);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const recallContext = useCallback(async (agentId: string, message: string) => {
    return await recallContextForAgent(agentId, message);
  }, []);

  // ── Embedding ────────────────────────────────────────────────────────
  const embed = useCallback(async (
    sourceType: EmbeddingSourceType,
    sourceId: string,
    agentId: string,
    text: string
  ) => {
    return await storeEmbedding(sourceType, sourceId, agentId, text);
  }, []);

  // ── Priorities ───────────────────────────────────────────────────────
  const loadPriorities = useCallback(async (scope?: PriorityScope, scopeTarget?: string) => {
    await loadPrioritiesInternal(scope, scopeTarget);
  }, [loadPrioritiesInternal]);

  const addPriority = useCallback(async (
    title: string,
    description?: string,
    scope?: PriorityScope,
    scopeTarget?: string
  ) => {
    const result = await setPriority(title, description, scope || 'global', scopeTarget);
    if (result) {
      // Realtime will update state, but optimistic add
      setPrioritiesState(prev => [...prev, result].sort((a, b) => a.priority_rank - b.priority_rank));
    }
    return result;
  }, []);

  const removePriority = useCallback(async (id: string) => {
    const result = await completePriority(id);
    if (result) {
      setPrioritiesState(prev => prev.filter(p => p.id !== id));
    }
    return result;
  }, []);

  const reorder = useCallback(async (orderedIds: string[]) => {
    return await reorderPriorities(orderedIds);
  }, []);

  const priorityContextForAgent = useCallback(async (agentId: string, teamId?: string) => {
    const agentPriorities = await getAgentPriorities(agentId, teamId);
    return formatPrioritiesForAgent(agentPriorities);
  }, []);

  // ── Feedback & Learning ──────────────────────────────────────────────
  const loadPatterns = useCallback(async (agentId: string) => {
    const data = await getAgentMistakes(agentId);
    setPatternsState(data);
  }, []);

  const extractPatterns = useCallback(async (agentId: string) => {
    setIsLoading(true);
    try {
      const extracted = await extractFeedbackPatterns(agentId);
      setPatternsState(prev => {
        // Merge new patterns with existing, avoiding duplicates
        const existing = new Set(prev.map(p => p.id));
        const newOnes = extracted.filter(p => !existing.has(p.id));
        return [...prev, ...newOnes];
      });
      return extracted;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const recordFeedback = useCallback(async (
    agentId: string,
    action: 'approved' | 'rejected' | 'revised',
    context: string,
    reason?: string
  ) => {
    await recordAgentFeedback(agentId, action, context, reason);
  }, []);

  const getMistakes = useCallback(async (agentId: string) => {
    return await getAgentMistakes(agentId);
  }, []);

  // ── Summarization ────────────────────────────────────────────────────
  const createDailySummaryForAgent = useCallback(async (agentId: string) => {
    setIsLoading(true);
    try {
      return await createDailySummary(agentId);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createWeeklySummaryForAgent = useCallback(async (agentId: string) => {
    setIsLoading(true);
    try {
      return await createWeeklySummary(agentId);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    search,
    recallContext,
    embed,
    priorities,
    loadPriorities,
    addPriority,
    removePriority,
    reorder,
    priorityContextForAgent,
    patterns,
    loadPatterns,
    extractPatterns,
    recordFeedback,
    getMistakes,
    createDailySummaryForAgent,
    createWeeklySummaryForAgent,
    isLoading,
  };
}
