import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { generateQueryEmbedding } from '../_shared/geminiEmbedding.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, entity_types, limit, threshold, hybrid } = await req.json();

    // Validate query
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'query is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAdminClient();

    // Generate query embedding (RETRIEVAL_QUERY task type)
    const values = await generateQueryEmbedding(query);

    // Format as PostgreSQL vector string
    const vectorString = `[${values.join(',')}]`;

    // Search parameters
    const searchLimit = limit ?? 10;
    const searchThreshold = threshold ?? 0.5;
    const filterTypes = entity_types ?? null;

    let results;

    if (hybrid) {
      // Hybrid search: combines vector similarity with full-text search
      const { data, error } = await supabase.rpc('hybrid_search_entities', {
        query_text: query,
        query_embedding: vectorString,
        filter_entity_types: filterTypes,
        match_limit: searchLimit,
        similarity_threshold: searchThreshold,
      });

      if (error) {
        throw new Error(`Hybrid search failed: ${error.message}`);
      }
      results = data;
    } else {
      // Pure vector similarity search
      const { data, error } = await supabase.rpc('match_entities', {
        query_embedding: vectorString,
        filter_entity_types: filterTypes,
        match_limit: searchLimit,
        similarity_threshold: searchThreshold,
      });

      if (error) {
        throw new Error(`Vector search failed: ${error.message}`);
      }
      results = data;
    }

    return new Response(
      JSON.stringify({ results: results ?? [], query }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
