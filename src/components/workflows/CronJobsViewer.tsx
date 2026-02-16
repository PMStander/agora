import { useState } from 'react';
import {
  useOpenClawCron,
  describeCronSchedule,
  formatDuration,
  timeAgo,
  timeUntil,
  type CronJob,
} from '../../hooks/useOpenClawCron';

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="px-1.5 py-0.5 text-xs rounded bg-zinc-700 text-zinc-400">No runs</span>;

  const config: Record<string, { bg: string; text: string; label: string }> = {
    ok: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'OK' },
    error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Error' },
    skipped: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Skipped' },
  };

  const c = config[status] || config.ok;
  return <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

// ─── Job Row (Expanded) ──────────────────────────────────────────────────────

function JobDetail({ job }: { job: CronJob }) {
  const promptText = job.payload.message || job.payload.text || '';
  const preview = promptText.slice(0, 300);
  const truncated = promptText.length > 300;

  return (
    <div className="px-4 py-3 bg-zinc-900/80 border-t border-zinc-800/50 text-xs space-y-2">
      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-500">
        <span>ID: <code className="text-zinc-400">{job.id.slice(0, 8)}</code></span>
        <span>Agent: <span className="text-zinc-300">{job.agentId}</span></span>
        <span>Session: <span className="text-zinc-300">{job.sessionTarget}</span></span>
        <span>Payload: <span className="text-zinc-300">{job.payload.kind}</span></span>
        {job.payload.timeoutSeconds && (
          <span>Timeout: <span className="text-zinc-300">{job.payload.timeoutSeconds}s</span></span>
        )}
        {job.delivery && (
          <span>Delivery: <span className="text-zinc-300">
            {job.delivery.mode}{job.delivery.channel ? ` → ${job.delivery.channel}` : ''}
          </span></span>
        )}
      </div>

      {/* Run stats */}
      {job.state && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-500">
          {job.state.lastRunAtMs && (
            <span>Last run: <span className="text-zinc-300">{new Date(job.state.lastRunAtMs).toLocaleString()}</span></span>
          )}
          {job.state.lastDurationMs != null && (
            <span>Duration: <span className="text-zinc-300">{formatDuration(job.state.lastDurationMs)}</span></span>
          )}
          {job.state.consecutiveErrors != null && job.state.consecutiveErrors > 0 && (
            <span className="text-red-400">Consecutive errors: {job.state.consecutiveErrors}</span>
          )}
        </div>
      )}

      {/* Error message */}
      {job.state?.lastError && (
        <div className="px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono">
          {job.state.lastError}
        </div>
      )}

      {/* Prompt preview */}
      {preview && (
        <div className="space-y-1">
          <span className="text-zinc-500">Prompt:</span>
          <pre className="px-2 py-1.5 rounded bg-zinc-800/80 text-zinc-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto font-mono leading-relaxed">
            {preview}{truncated ? '…' : ''}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Job Row ─────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: CronJob }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className="px-4 py-3 hover:bg-zinc-800/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Expand chevron */}
              <svg
                className={`w-3.5 h-3.5 text-zinc-500 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>

              <span className="text-sm font-medium text-zinc-200 truncate">
                {job.name}
              </span>

              {!job.enabled && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-zinc-700 text-zinc-500 font-medium">
                  Disabled
                </span>
              )}

              <StatusBadge status={job.state?.lastStatus} />
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500 ml-5.5">
              <span className="flex items-center gap-1">
                {/* Clock icon */}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {describeCronSchedule(job.schedule)}
              </span>

              {job.state?.lastRunAtMs && (
                <span>ran {timeAgo(job.state.lastRunAtMs)}</span>
              )}

              {job.state?.lastDurationMs != null && (
                <span>{formatDuration(job.state.lastDurationMs)}</span>
              )}

              {job.enabled && job.state?.nextRunAtMs && (
                <span className="text-amber-500/70">next {timeUntil(job.state.nextRunAtMs)}</span>
              )}
            </div>
          </div>

          {/* Right side: enabled toggle indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`w-2 h-2 rounded-full ${
                !job.enabled
                  ? 'bg-zinc-600'
                  : job.state?.lastStatus === 'error'
                  ? 'bg-red-500'
                  : job.state?.lastStatus === 'ok'
                  ? 'bg-green-500'
                  : 'bg-amber-500'
              }`}
            />
          </div>
        </div>
      </div>

      {expanded && <JobDetail job={job} />}
    </div>
  );
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────

function StatsBar({ stats, lastRefresh, onRefresh }: {
  stats: { total: number; enabled: number; disabled: number; healthy: number; errored: number };
  lastRefresh: number;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800 bg-zinc-900/30">
      <span>
        <span className="text-zinc-300 font-medium">{stats.enabled}</span> active
      </span>
      {stats.disabled > 0 && (
        <span>
          <span className="text-zinc-400">{stats.disabled}</span> disabled
        </span>
      )}
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        <span className="text-green-400">{stats.healthy}</span> healthy
      </span>
      {stats.errored > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          <span className="text-red-400">{stats.errored}</span> errored
        </span>
      )}

      <div className="flex-1" />

      {lastRefresh > 0 && (
        <span className="text-zinc-600">
          updated {timeAgo(lastRefresh)}
        </span>
      )}

      <button
        onClick={onRefresh}
        className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        title="Refresh"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CronJobsViewer() {
  const { jobs, loading, error, stats, lastRefresh, refresh } = useOpenClawCron();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);

  const filtered = jobs.filter(job => {
    if (!showDisabled && !job.enabled) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.name.toLowerCase().includes(q) ||
      job.agentId.toLowerCase().includes(q) ||
      (job.schedule.expr?.includes(q) ?? false)
    );
  });

  // Sort: enabled first, then by next run time
  const sorted = [...filtered].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const aNext = a.state?.nextRunAtMs ?? Infinity;
    const bNext = b.state?.nextRunAtMs ?? Infinity;
    return aNext - bNext;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Loading cron jobs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-2">Failed to load cron jobs</p>
          <p className="text-xs text-zinc-600 mb-3 max-w-md">{error}</p>
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <StatsBar stats={stats} lastRefresh={lastRefresh} onRefresh={refresh} />

      {/* Search + filter */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search cron jobs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
        />
        {stats.disabled > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/30"
            />
            Show disabled
          </label>
        )}
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            {searchQuery ? 'No jobs match your search.' : 'No cron jobs found.'}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {sorted.map(job => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
