/**
 * Entity Embedding Search
 * Client-side wrapper for the entity embedding Edge Functions.
 * Provides semantic search across all Agora entities via Gemini embeddings.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  EntitySearchResult,
  EntitySearchOptions,
  EmbedEntityResponse,
  ProcessQueueResponse,
  EmbedQueryResponse,
  EmbeddingQueueStats,
  EmbeddableEntityType,
} from '../types/entityEmbeddings';

/**
 * Search entities using semantic similarity via Gemini embeddings.
 */
export async function searchEntities(
  query: string,
  options: EntitySearchOptions = {}
): Promise<EntitySearchResult[]> {
  if (!isSupabaseConfigured() || !query.trim()) return [];

  const { entityTypes, limit = 10, threshold = 0.3, hybrid = false } = options;

  const { data, error } = await supabase.functions.invoke('embed-query', {
    body: {
      query,
      entity_types: entityTypes || null,
      limit,
      threshold,
      hybrid,
    },
  });

  if (error) {
    console.error('[EmbeddingSearch] searchEntities error:', error);
    return [];
  }

  return (data as EmbedQueryResponse)?.results || [];
}

/**
 * Trigger embedding for a single entity (on-demand).
 */
export async function embedEntity(
  entityType: EmbeddableEntityType,
  entityId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data, error } = await supabase.functions.invoke('embed-entity', {
    body: { entity_type: entityType, entity_id: entityId },
  });

  if (error) {
    console.error('[EmbeddingSearch] embedEntity error:', error);
    return false;
  }

  return (data as EmbedEntityResponse)?.success || false;
}

/**
 * Process pending items in the embedding queue.
 */
export async function processEmbeddingQueue(
  batchSize = 20
): Promise<ProcessQueueResponse | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase.functions.invoke('process-embedding-queue', {
    body: { batch_size: batchSize },
  });

  if (error) {
    console.error('[EmbeddingSearch] processQueue error:', error);
    return null;
  }

  return data as ProcessQueueResponse;
}

/**
 * Get queue statistics (pending, processing, failed counts).
 */
export async function getQueueStats(): Promise<EmbeddingQueueStats> {
  const empty: EmbeddingQueueStats = { pending: 0, processing: 0, completed: 0, failed: 0 };
  if (!isSupabaseConfigured()) return empty;

  // Query counts grouped by status
  const { data, error } = await supabase
    .from('embedding_queue')
    .select('status')
    .in('status', ['pending', 'processing', 'failed']);

  if (error) {
    console.error('[EmbeddingSearch] getQueueStats error:', error);
    return empty;
  }

  const stats = { ...empty };
  for (const row of data || []) {
    const s = row.status as keyof EmbeddingQueueStats;
    if (s in stats) stats[s]++;
  }

  return stats;
}
