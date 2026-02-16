import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CronJobSchedule {
  kind: 'cron' | 'every' | 'at';
  expr?: string;
  tz?: string;
  everyMs?: number;
  anchorMs?: number;
  at?: string;
}

export interface CronJobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: 'ok' | 'error' | 'skipped';
  lastDurationMs?: number;
  lastError?: string;
  consecutiveErrors?: number;
}

export interface CronJobDelivery {
  mode: 'announce' | 'none';
  channel?: string;
  to?: string;
}

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronJobSchedule;
  sessionTarget: string;
  wakeMode: string;
  payload: {
    kind: string;
    message?: string;
    text?: string;
    timeoutSeconds?: number;
  };
  delivery?: CronJobDelivery;
  state?: CronJobState;
}

interface CronJobsFile {
  version: number;
  jobs: CronJob[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function describeCronSchedule(schedule: CronJobSchedule): string {
  if (schedule.kind === 'every' && schedule.everyMs) {
    const mins = Math.round(schedule.everyMs / 60000);
    if (mins < 60) return `Every ${mins}min`;
    const hrs = Math.round(mins / 60);
    return `Every ${hrs}h`;
  }

  if (schedule.kind === 'at' && schedule.at) {
    const d = new Date(schedule.at);
    return `Once at ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  if (schedule.kind === 'cron' && schedule.expr) {
    return cronExprToHuman(schedule.expr, schedule.tz);
  }

  return schedule.kind;
}

function cronExprToHuman(expr: string, tz?: string): string {
  const parts = expr.split(' ');
  if (parts.length < 5) return expr;

  const [min, hour, _dom, _mon, dow] = parts;
  const tzLabel = tz ? ` ${tz.split('/').pop()}` : '';

  // */N minute patterns
  if (min.startsWith('*/')) {
    return `Every ${min.slice(2)}min`;
  }

  // Specific time patterns
  const timeStr = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

  if (dow === '*') return `Daily at ${timeStr}${tzLabel}`;

  const dayNames: Record<string, string> = {
    '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed',
    '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun',
  };

  const days = dow.split(',').map(d => dayNames[d] || d).join(', ');
  return `${days} at ${timeStr}${tzLabel}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`;
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

export function timeUntil(ms: number): string {
  const diff = ms - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 60000) return `in ${Math.round(diff / 1000)}s`;
  if (diff < 3600000) return `in ${Math.round(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.round(diff / 3600000)}h`;
  return `in ${Math.round(diff / 86400000)}d`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const CRON_JOBS_PATH = '/Users/peetstander/.openclaw/cron/jobs.json';
const POLL_INTERVAL = 30_000; // Re-read every 30s for state changes

export function useOpenClawCron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const text = await readTextFile(CRON_JOBS_PATH);
      const data: CronJobsFile = JSON.parse(text);
      setJobs(data.jobs || []);
      setError(null);
      setLastRefresh(Date.now());
    } catch (err) {
      console.error('[useOpenClawCron] Failed to read cron jobs:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    loadJobs();
    intervalRef.current = setInterval(loadJobs, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadJobs]);

  const enabledJobs = jobs.filter(j => j.enabled);
  const disabledJobs = jobs.filter(j => !j.enabled);

  const stats = {
    total: jobs.length,
    enabled: enabledJobs.length,
    disabled: disabledJobs.length,
    healthy: enabledJobs.filter(j => j.state?.lastStatus === 'ok').length,
    errored: enabledJobs.filter(j => j.state?.lastStatus === 'error').length,
  };

  return {
    jobs,
    enabledJobs,
    disabledJobs,
    loading,
    error,
    stats,
    lastRefresh,
    refresh: loadJobs,
  };
}
