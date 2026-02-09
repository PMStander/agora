/**
 * Embedding Service
 * Generates 384-dimensional embeddings client-side using a lightweight approach,
 * stores them in Supabase pgvector, and provides semantic search via RPC.
 *
 * We use a simple TF-IDF-like hashing approach for embeddings (no external API needed).
 * This can be upgraded to use OpenAI embeddings or a local model later.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import type { SemanticSearchResult, SemanticSearchOptions, EmbeddingSourceType } from '../../types/memoryIntelligence';

const EMBEDDING_DIM = 384;

/**
 * Generate a lightweight embedding from text using deterministic hashing.
 * This is a simple but effective approach for semantic similarity:
 * - Tokenizes text into words and bigrams
 * - Hashes each token to a position in the 384-dim vector
 * - Normalizes the vector to unit length
 *
 * For production, this can be swapped for OpenAI/Cohere embeddings.
 */
export function generateEmbedding(text: string): number[] {
  const vec = new Float32Array(EMBEDDING_DIM).fill(0);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const words = normalized.split(/\s+/).filter(w => w.length > 1);

  // Unigrams
  for (const word of words) {
    const hash = hashString(word);
    const idx = Math.abs(hash) % EMBEDDING_DIM;
    const sign = hash > 0 ? 1 : -1;
    vec[idx] += sign * 1.0;
  }

  // Bigrams for phrase-level semantics
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + '_' + words[i + 1];
    const hash = hashString(bigram);
    const idx = Math.abs(hash) % EMBEDDING_DIM;
    const sign = hash > 0 ? 1 : -1;
    vec[idx] += sign * 0.5;
  }

  // Trigrams for even more context
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = words[i] + '_' + words[i + 1] + '_' + words[i + 2];
    const hash = hashString(trigram);
    const idx = Math.abs(hash) % EMBEDDING_DIM;
    const sign = hash > 0 ? 1 : -1;
    vec[idx] += sign * 0.3;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

/** Simple deterministic hash function (FNV-1a inspired) */
function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash;
}

/**
 * Store a text chunk as an embedding in the database.
 */
export async function storeEmbedding(
  sourceType: EmbeddingSourceType,
  sourceId: string,
  agentId: string,
  contentText: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  if (!isSupabaseConfigured() || !contentText.trim()) return false;

  const embedding = generateEmbedding(contentText);

  // Format embedding as a PostgreSQL vector string: "[0.1,0.2,...]"
  const embeddingStr = `[${embedding.join(',')}]`;

  const { error } = await supabase
    .from('memory_embeddings')
    .upsert({
      source_type: sourceType,
      source_id: sourceId,
      agent_id: agentId,
      content_text: contentText,
      embedding: embeddingStr,
      metadata: metadata || {},
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'source_type,source_id',
      ignoreDuplicates: false,
    });

  if (error) {
    // If upsert fails (no unique constraint on source_type+source_id), just insert
    const { error: insertError } = await supabase
      .from('memory_embeddings')
      .insert({
        source_type: sourceType,
        source_id: sourceId,
        agent_id: agentId,
        content_text: contentText,
        embedding: embeddingStr,
        metadata: metadata || {},
      });

    if (insertError) {
      console.error('[EmbeddingService] storeEmbedding error:', insertError);
      return false;
    }
  }

  return true;
}

/**
 * Semantic search: find similar memories using cosine similarity via pgvector.
 */
export async function semanticSearch(
  query: string,
  options: SemanticSearchOptions = {}
): Promise<SemanticSearchResult[]> {
  if (!isSupabaseConfigured() || !query.trim()) return [];

  const { agentId, sourceTypes, threshold = 0.3, limit = 10 } = options;
  const embedding = generateEmbedding(query);
  const embeddingStr = `[${embedding.join(',')}]`;

  const { data, error } = await supabase.rpc('match_memories', {
    query_embedding: embeddingStr,
    match_threshold: threshold,
    match_count: limit,
    filter_agent_id: agentId || null,
    filter_source_types: sourceTypes || null,
  });

  if (error) {
    console.error('[EmbeddingService] semanticSearch error:', error);
    return [];
  }

  return (data || []) as SemanticSearchResult[];
}

/**
 * Batch-embed multiple texts (e.g., during daily summarization).
 */
export async function batchStoreEmbeddings(
  items: Array<{
    sourceType: EmbeddingSourceType;
    sourceId: string;
    agentId: string;
    contentText: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  let successCount = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const rows = batch.map(item => ({
      source_type: item.sourceType,
      source_id: item.sourceId,
      agent_id: item.agentId,
      content_text: item.contentText,
      embedding: `[${generateEmbedding(item.contentText).join(',')}]`,
      metadata: item.metadata || {},
    }));

    const { error } = await supabase.from('memory_embeddings').insert(rows);
    if (!error) {
      successCount += batch.length;
    } else {
      console.error('[EmbeddingService] batchStore error:', error);
    }
  }

  return successCount;
}
