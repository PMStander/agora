import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { generateDocumentEmbedding } from '../_shared/geminiEmbedding.ts';
import { buildEntityText } from '../_shared/entityTextBuilder.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { entity_type, entity_id } = await req.json();

    // Validate inputs
    if (!entity_type || typeof entity_type !== 'string') {
      return new Response(
        JSON.stringify({ error: 'entity_type is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!entity_id || typeof entity_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'entity_id is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAdminClient();

    // Build text representation
    const text = await buildEntityText(entity_type, entity_id, supabase);

    // Generate 768-dim embedding
    const values = await generateDocumentEmbedding(text);

    // Format as PostgreSQL vector string
    const vectorString = `[${values.join(',')}]`;

    // Upsert into entity_embeddings
    const { error: upsertError } = await supabase
      .from('entity_embeddings')
      .upsert(
        {
          entity_type,
          entity_id,
          embedding: vectorString,
          content: text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'entity_type,entity_id' }
      );

    if (upsertError) {
      throw new Error(`Upsert failed: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        entity_type,
        entity_id,
        content_length: text.length,
      }),
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
