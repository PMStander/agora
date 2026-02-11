// ─── Entity Embedding Types ──────────────────────────────────────────────────

export type EmbeddableEntityType =
  | 'company'
  | 'contact'
  | 'deal'
  | 'interaction'
  | 'product'
  | 'product_category'
  | 'order'
  | 'quote'
  | 'invoice'
  | 'project'
  | 'mission'
  | 'task'
  | 'email'
  | 'email_template'
  | 'calendar_event'
  | 'workflow'
  | 'workflow_sequence'
  | 'document'
  | 'crm_document'
  | 'agent'
  | 'boardroom_message'
  | 'notification';

// ─── Entity Embeddings ──────────────────────────────────────────────────────

export interface EntityEmbedding {
  id: string;
  entity_type: EmbeddableEntityType;
  entity_id: string;
  content_text: string;
  embedding?: number[];  // 768-dimensional vector, optional in client
  metadata: Record<string, unknown>;
  model: string;
  created_at: string;
  updated_at: string;
}

// ─── Embedding Queue ──────────────────────────────────────────────────────

export type EmbeddingQueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface EmbeddingQueueItem {
  id: string;
  entity_type: EmbeddableEntityType;
  entity_id: string;
  priority: number;
  status: EmbeddingQueueStatus;
  attempts: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

// ─── Search ──────────────────────────────────────────────────────────────

export interface EntitySearchResult {
  id: string;
  entity_type: EmbeddableEntityType;
  entity_id: string;
  content_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface EntitySearchOptions {
  entityTypes?: EmbeddableEntityType[];
  limit?: number;
  threshold?: number;
  hybrid?: boolean;
}

// ─── Queue Stats ──────────────────────────────────────────────────────────

export interface EmbeddingQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

// ─── Edge Function Responses ──────────────────────────────────────────────

export interface EmbedEntityResponse {
  success: boolean;
  entity_type: EmbeddableEntityType;
  entity_id: string;
  content_length: number;
}

export interface ProcessQueueResponse {
  processed: number;
  failed: number;
  remaining: number;
}

export interface EmbedQueryResponse {
  results: EntitySearchResult[];
  query: string;
}
