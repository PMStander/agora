/**
 * Background Embedding Queue Processor
 * Polls the process-embedding-queue Edge Function every 60 seconds
 * to process any pending entity embeddings.
 * Mount once in App.tsx alongside useMissionScheduler.
 */

import { useEffect, useRef } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { processEmbeddingQueue } from '../lib/embeddingSearch';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export function useEmbeddingQueueProcessor() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const result = await processEmbeddingQueue(20);
        if (result && (result.processed > 0 || result.failed > 0)) {
          console.log(
            `[EmbeddingQueue] Processed ${result.processed}, failed ${result.failed}, remaining ${result.remaining}`
          );
        }
      } catch (err) {
        // Non-blocking — queue processing failure should never crash the app
        console.warn('[EmbeddingQueue] Processing error (non-blocking):', err);
      }
    };

    // Initial tick after a short delay (let app settle)
    const startDelay = setTimeout(() => {
      tick();
      timer = setInterval(tick, POLL_INTERVAL_MS);
    }, 5_000);

    return () => {
      clearTimeout(startDelay);
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
