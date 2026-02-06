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

// Real-time subscriptions
export function subscribeToTasks(callback: (payload: any) => void): RealtimeChannel {
  return supabase
    .channel('tasks-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      callback
    )
    .subscribe();
}

export function subscribeToComments(taskId: string, callback: (payload: any) => void): RealtimeChannel {
  return supabase
    .channel(`comments-${taskId}`)
    .on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'comments',
        filter: `task_id=eq.${taskId}`
      },
      callback
    )
    .subscribe();
}

export function subscribeToActivities(callback: (payload: any) => void): RealtimeChannel {
  return supabase
    .channel('activities-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activities' },
      callback
    )
    .subscribe();
}

// Helper to log activities
export async function logActivity(
  type: string,
  taskId: string | null,
  message: string,
  agentId?: string,
  metadata?: Record<string, any>
) {
  return supabase.from('activities').insert({
    type,
    task_id: taskId,
    agent_id: agentId,
    message,
    metadata,
  });
}
