// ─── Boardroom Auto-Start Scheduler ──────────────────────────────────────────
// Automatically starts scheduled sessions when their time arrives

import { useEffect, useRef } from 'react';
import { useBoardroomStore } from '../stores/boardroom';
import { useBoardroom } from './useBoardroom';
import type { BoardroomSessionMetadata } from '../types/boardroom';

const POLL_INTERVAL_MS = 30_000; // Check every 30 seconds

export function useBoardroomAutoStart(
  runSession: (sessionId: string) => Promise<void>
) {
  const sessions = useBoardroomStore((s) => s.sessions);
  const { updateSession, updateSessionMetadata } = useBoardroom();

  // Track processed sessions and the scheduled_at they were processed with
  // so rescheduling to a new time clears the processed entry.
  const processedRef = useRef<Map<string, string>>(new Map()); // sessionId → scheduled_at

  useEffect(() => {
    const checkScheduledSessions = async () => {
      const now = new Date();

      for (const session of sessions) {
        if (session.status !== 'scheduled' || !session.scheduled_at) continue;

        const metadata = (session.metadata || {}) as BoardroomSessionMetadata;
        if (metadata.auto_start === false) continue;

        // If we already processed this session for the SAME scheduled_at, skip
        const processed = processedRef.current.get(session.id);
        if (processed === session.scheduled_at) continue;

        const scheduledTime = new Date(session.scheduled_at);
        if (now < scheduledTime) continue;

        console.log(`[BoardroomAutoStart] Triggering session: ${session.title} (${session.id})`);

        // Mark as processed with this specific scheduled_at
        processedRef.current.set(session.id, session.scheduled_at);

        try {
          // Persist the trigger so a page refresh won't re-trigger
          await updateSessionMetadata(session.id, { auto_start_triggered_at: now.toISOString() } as any);

          // Update status to active
          await updateSession(session.id, { status: 'active', started_at: now.toISOString() });

          // Start the orchestration
          await runSession(session.id);
        } catch (err) {
          console.error(`[BoardroomAutoStart] Failed to start session ${session.id}:`, err);
          // Remove so it can retry
          processedRef.current.delete(session.id);
        }
      }
    };

    // Initial check
    checkScheduledSessions();

    // Set up polling interval
    const intervalId = setInterval(checkScheduledSessions, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [sessions, runSession, updateSession, updateSessionMetadata]);

  // Clean up entries for sessions that no longer exist
  useEffect(() => {
    const activeSessionIds = new Set(sessions.map((s) => s.id));
    for (const id of processedRef.current.keys()) {
      if (!activeSessionIds.has(id)) {
        processedRef.current.delete(id);
      }
    }
  }, [sessions]);
}
