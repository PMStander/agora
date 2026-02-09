/**
 * Shared Supabase Realtime payload handler.
 *
 * Every hook that subscribes to `postgres_changes` duplicated the same
 * INSERT / UPDATE / DELETE switch. This module extracts that logic into
 * a single, generic, type-safe utility.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RealtimePayload = { eventType: string; new: any; old: any };

/**
 * Dispatch a Supabase Realtime payload to the appropriate store callback.
 *
 * @param payload  - The Realtime change payload from Supabase
 * @param add      - Called on INSERT with the full new row
 * @param update   - Called on UPDATE with (id, partial row)
 * @param remove   - Called on DELETE with the old row's id
 */
export function handleRealtimePayload<T extends { id: string }>(
  payload: RealtimePayload,
  add: (item: T) => void,
  update: (id: string, updates: Partial<T>) => void,
  remove: (id: string) => void
): void {
  switch (payload.eventType) {
    case 'INSERT':
      add(payload.new as T);
      break;
    case 'UPDATE':
      update((payload.new as T).id, payload.new as Partial<T>);
      break;
    case 'DELETE':
      if (payload.old?.id) remove(payload.old.id as string);
      break;
  }
}
