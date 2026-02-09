import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Using any for flexibility - types enforced at application layer
export const supabase = createClient(supabaseUrl, supabaseKey);

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseKey !== '';
};

// ─── Real-time Subscriptions ────────────────────────────────────────────────

export function subscribeToMissions(
  callback: (payload: any) => void,
  onStatus?: (status: string) => void
): RealtimeChannel {
  return supabase
    .channel('missions-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'missions' },
      callback
    )
    .on('system', { event: 'status' }, (payload) => {
      if (onStatus && payload?.status) onStatus(payload.status);
    })
    .subscribe();
}

export function subscribeToMissionLogs(
  missionId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  return supabase
    .channel(`mission-logs-${missionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mission_logs',
        filter: `mission_id=eq.${missionId}`,
      },
      callback
    )
    .subscribe();
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
