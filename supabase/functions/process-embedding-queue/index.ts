import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { generateDocumentEmbedding } from '../_shared/geminiEmbedding.ts';
import { buildEntityText } from '../_shared/entityTextBuilder.ts';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = body.batch_size ?? 20;

    const supabase = createAdminClient();

    // Lock a batch of pending items via RPC
    const { data: batch, error: lockError } = await supabase.rpc('lock_embedding_batch', {
      p_batch_size: batchSize,
    });

    if (lockError) {
      throw new Error(`Failed to lock batch: ${lockError.message}`);
    }

    if (!batch || batch.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, failed: 0, remaining: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    // Process items sequentially to avoid Gemini rate limits
    for (const item of batch) {
      try {
        // Build text representation
        const text = await buildEntityText(item.entity_type, item.entity_id, supabase);

        // Generate embedding
        const values = await generateDocumentEmbedding(text);

        // Format as PostgreSQL vector string
        const vectorString = `[${values.join(',')}]`;

        // Upsert into entity_embeddings
        const { error: upsertError } = await supabase
          .from('entity_embeddings')
          .upsert(
            {
              entity_type: item.entity_type,
              entity_id: item.entity_id,
              embedding: vectorString,
              content_text: text,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'entity_type,entity_id' }
          );

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        // Mark queue item as completed
        await supabase
          .from('embedding_queue')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', item.id);

        processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const newAttempts = (item.attempts || 0) + 1;

        if (newAttempts >= 3) {
          // Max retries exceeded — mark as failed
          await supabase
            .from('embedding_queue')
            .update({
              status: 'failed',
              attempts: newAttempts,
              error_message: message,
            })
            .eq('id', item.id);
          failed++;
        } else {
          // Return to pending for retry
          await supabase
            .from('embedding_queue')
            .update({
              status: 'pending',
              attempts: newAttempts,
              error_message: message,
            })
            .eq('id', item.id);
        }
      }

      // Small delay between API calls to avoid rate limits
      await delay(100);
    }

    // Count remaining pending items
    const { count: remaining } = await supabase
      .from('embedding_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    return new Response(
      JSON.stringify({
        processed,
        failed,
        remaining: remaining ?? 0,
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
