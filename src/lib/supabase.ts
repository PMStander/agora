import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Using any for flexibility - types enforced at application layer
export const supabase = createClient(supabaseUrl, supabaseKey);

// Check if Supabase is configured (env vars present)
export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseKey !== '';
};

// ─── Health Check ──────────────────────────────────────────────────────────

type SupabaseHealth = {
  reachable: boolean;
  latencyMs: number;
  error?: string;
};

let _lastHealth: SupabaseHealth = { reachable: false, latencyMs: 0 };
let _healthListeners: Array<(h: SupabaseHealth) => void> = [];

/** Subscribe to health changes. Returns unsubscribe function. */
export function onHealthChange(fn: (h: SupabaseHealth) => void) {
  _healthListeners.push(fn);
  // Immediately fire with current state
  fn(_lastHealth);
  return () => {
    _healthListeners = _healthListeners.filter((f) => f !== fn);
  };
}

export function getSupabaseHealth(): SupabaseHealth {
  return _lastHealth;
}

/** Ping Supabase and update health state. */
export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  if (!isSupabaseConfigured()) {
    const h: SupabaseHealth = { reachable: false, latencyMs: 0, error: 'Not configured' };
    _lastHealth = h;
    _healthListeners.forEach((fn) => fn(h));
    return h;
  }

  const start = performance.now();
  try {
    // Lightweight query — just check if we can reach Postgres
    const { error } = await supabase.from('agents').select('id', { count: 'exact', head: true });
    const latencyMs = Math.round(performance.now() - start);
    const h: SupabaseHealth = error
      ? { reachable: false, latencyMs, error: error.message }
      : { reachable: true, latencyMs };
    _lastHealth = h;
    _healthListeners.forEach((fn) => fn(h));
    return h;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const h: SupabaseHealth = {
      reachable: false,
      latencyMs,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
    _lastHealth = h;
    _healthListeners.forEach((fn) => fn(h));
    return h;
  }
}

// ─── Real-time Subscriptions ────────────────────────────────────────────────

const REALTIME_RETRY_MS = 5_000;
const REALTIME_MAX_RETRIES = 5;

export function subscribeToMissions(
  callback: (payload: any) => void,
  onStatus?: (status: string) => void
): RealtimeChannel {
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentChannel: RealtimeChannel | null = null;
  let isActive = true;

  const createChannel = (): RealtimeChannel => {
    const channel = supabase
      .channel(`missions-changes-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'missions' },
        callback
      );

    channel.subscribe((status, err) => {
      if (!isActive) return;
      
      onStatus?.(status);

      if (status === 'SUBSCRIBED') {
        retryCount = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[Supabase Realtime] missions channel ${status}`, err?.message || '');
        if (retryCount < REALTIME_MAX_RETRIES && isActive) {
          retryCount++;
          const delay = REALTIME_RETRY_MS * retryCount;
          console.log(`[Supabase Realtime] retrying in ${delay}ms (attempt ${retryCount}/${REALTIME_MAX_RETRIES})`);
          
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(() => {
            if (!isActive) return;
            if (currentChannel) {
              supabase.removeChannel(currentChannel);
            }
            currentChannel = createChannel();
          }, delay);
        }
      }
    });

    return channel;
  };

  currentChannel = createChannel();

  // Return a wrapper that handles cleanup properly
  return {
    ...currentChannel,
    unsubscribe: () => {
      isActive = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (currentChannel) {
        return currentChannel.unsubscribe();
      }
      return Promise.resolve('ok');
    },
  } as RealtimeChannel;
}

export function subscribeToMissionLogs(
  missionId: string,
  callback: (payload: any) => void,
  onStatus?: (status: string) => void
): RealtimeChannel {
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentChannel: RealtimeChannel | null = null;
  let isActive = true;

  const createChannel = (): RealtimeChannel => {
    const channel = supabase
      .channel(`mission-logs-${missionId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mission_logs',
          filter: `mission_id=eq.${missionId}`,
        },
        callback
      );

    channel.subscribe((status, err) => {
      if (!isActive) return;
      
      onStatus?.(status);

      if (status === 'SUBSCRIBED') {
        retryCount = 0;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[Supabase Realtime] logs channel ${status} for mission ${missionId}`, err?.message || '');
        if (retryCount < REALTIME_MAX_RETRIES && isActive) {
          retryCount++;
          const delay = REALTIME_RETRY_MS * retryCount;
          console.log(`[Supabase Realtime] retrying logs in ${delay}ms (attempt ${retryCount}/${REALTIME_MAX_RETRIES})`);
          
          if (retryTimeout) clearTimeout(retryTimeout);
          retryTimeout = setTimeout(() => {
            if (!isActive) return;
            if (currentChannel) {
              supabase.removeChannel(currentChannel);
            }
            currentChannel = createChannel();
          }, delay);
        }
      }
    });

    return channel;
  };

  currentChannel = createChannel();

  // Return a wrapper that handles cleanup properly
  return {
    ...currentChannel,
    unsubscribe: () => {
      isActive = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (currentChannel) {
        return currentChannel.unsubscribe();
      }
      return Promise.resolve('ok');
    },
  } as RealtimeChannel;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function logMissionEvent(
  missionId: string,
  type: string,
  message: string,
  agentId?: string,
  metadata?: Record<string, any>
) {
  return supabase.from('mission_logs').insert({
    mission_id: missionId,
    type,
    agent_id: agentId ?? null,
    message,
    metadata: metadata ?? null,
  });
}
