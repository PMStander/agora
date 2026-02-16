/**
 * Supabase Health Check Hook
 * Pings Supabase on mount and periodically to detect connection issues.
 * Exposes health state for the SupabaseHealthBanner component.
 */

import { useEffect, useRef, useState } from 'react';
import {
  checkSupabaseHealth,
  isSupabaseConfigured,
  onHealthChange,
} from '../lib/supabase';

const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function useSupabaseHealth() {
  const [reachable, setReachable] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Subscribe to health state changes
    const unsub = onHealthChange((h) => {
      setReachable(h.reachable);
      setError(h.error);
    });

    // Initial check (after a brief settle)
    const start = setTimeout(() => {
      checkSupabaseHealth();
    }, 1_500);

    // Periodic checks
    const interval = setInterval(() => {
      checkSupabaseHealth();
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      unsub();
      clearTimeout(start);
      clearInterval(interval);
    };
  }, []);

  return { reachable, error };
}
