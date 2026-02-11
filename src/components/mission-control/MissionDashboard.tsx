import { useMemo } from 'react';
import { useMissionControlStore } from '../../stores/missionControl';
import { AGENTS, getAgent } from '../../types/supabase';
import type { Mission, Task, AgentDef } from '../../types/supabase';

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  subtext,
}: {
  label: string;
  value: number;
  color: string;
  subtext?: string;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    zinc: { bg: 'bg-zinc-800/50', border: 'border-zinc-700', text: 'text-zinc-100', glow: '' },
    amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-300', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.05)]' },
    purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-300', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.05)]' },
    green: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-300', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.05)]' },
    red: { bg: 'bg-red-500/5', border: 'border-red-500/30', text: 'text-red-300', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.05)]' },
    blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-300', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.05)]' },
  };
  const c = colorMap[color] || colorMap.zinc;

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} ${c.glow} p-4`}>
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${c.text} tabular-nums`}>{value}</div>
      {subtext && <div className="text-[11px] text-zinc-500 mt-1">{subtext}</div>}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function MissionProgress({
  mission,
  missionTasks,
}: {
  mission: Mission;
  missionTasks: Task[];
}) {
  const selectMission = useMissionControlStore((s) => s.selectMission);
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const agent = getAgent(mission.agent_id);
  const total = missionTasks.length;
  const done = missionTasks.filter((t) => t.status === 'done').length;
  const failed = missionTasks.filter((t) => t.status === 'failed').length;
  const inProgress = missionTasks.filter((t) => t.status === 'in_progress').length;
  const review = missionTasks.filter((t) => t.status === 'review').length;
  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;
  const pctFailed = total > 0 ? Math.round((failed / total) * 100) : 0;
  const pctActive = total > 0 ? Math.round(((inProgress + review) / total) * 100) : 0;

  return (
    <button
      onClick={() => {
        selectTask(null);
        selectMission(mission.id);
      }}
      className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {agent && <span className="text-sm flex-shrink-0" title={`${agent.name} — ${agent.role}`}>{agent.emoji}</span>}
          <span className="text-xs font-medium text-zinc-200 truncate">{mission.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-zinc-500">{done}/{total}</span>
          <span className="text-xs font-semibold text-zinc-300 w-10 text-right">{pctDone}%</span>
        </div>
      </div>
      {/* Stacked bar */}
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex">
        {pctDone > 0 && (
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pctDone}%` }} />
        )}
        {pctActive > 0 && (
          <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pctActive}%` }} />
        )}
        {pctFailed > 0 && (
          <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${pctFailed}%` }} />
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-[10px] text-zinc-600">
          Phase: {mission.mission_phase || 'tasks'}
        </span>
        {inProgress > 0 && (
          <span className="text-[10px] text-amber-400">{inProgress} running</span>
        )}
        {review > 0 && (
          <span className="text-[10px] text-purple-400">{review} in review</span>
        )}
        {failed > 0 && (
          <span className="text-[10px] text-red-400">{failed} failed</span>
        )}
      </div>
    </button>
  );
}

// ─── Agent Utilization ──────────────────────────────────────────────────────

function AgentRow({
  agent,
  currentTask,
  queueCount,
  completedCount,
}: {
  agent: AgentDef;
  currentTask: Task | null;
  queueCount: number;
  completedCount: number;
}) {
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const isBusy = currentTask !== null;

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30">
      <span className="text-sm flex-shrink-0">{agent.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200">{agent.name}</span>
          <span className="text-[10px] text-zinc-600">{agent.role}</span>
        </div>
        {currentTask ? (
          <button
            onClick={() => selectTask(currentTask.id)}
            className="text-[11px] text-amber-400 truncate block hover:text-amber-300"
          >
            {currentTask.title}
          </button>
        ) : (
          <span className="text-[11px] text-zinc-600">Idle</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${isBusy ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
        <span className="text-[10px] text-zinc-500">{queueCount} queued</span>
        <span className="text-[10px] text-emerald-500">{completedCount} done</span>
      </div>
    </div>
  );
}

// ─── Review Stats ───────────────────────────────────────────────────────────

function ReviewStats({ tasks }: { tasks: Task[] }) {
  const stats = useMemo(() => {
    const reviewTasks = tasks.filter((t) => t.review_enabled);
    const withHistory = reviewTasks.filter((t) => t.review_history && t.review_history.length > 0);
    const totalReviews = withHistory.reduce((sum, t) => sum + t.review_history.length, 0);
    const approvals = withHistory.reduce(
      (sum, t) => sum + t.review_history.filter((r) => r.action === 'approve').length,
      0,
    );
    const avgRounds = withHistory.length > 0
      ? (totalReviews / withHistory.length).toFixed(1)
      : '0';
    const approvalRate = totalReviews > 0
      ? Math.round((approvals / totalReviews) * 100)
      : 0;
    const redoCount = tasks.filter((t) => t.title.endsWith('(Redo)')).length;

    return {
      reviewEnabled: reviewTasks.length,
      totalReviews,
      avgRounds,
      approvalRate,
      redoCount,
    };
  }, [tasks]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Review Metrics</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-lg font-bold text-purple-300 tabular-nums">{stats.reviewEnabled}</div>
          <div className="text-[10px] text-zinc-500">Review-enabled tasks</div>
        </div>
        <div>
          <div className="text-lg font-bold text-zinc-200 tabular-nums">{stats.totalReviews}</div>
          <div className="text-[10px] text-zinc-500">Total reviews</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-300 tabular-nums">{stats.avgRounds}</div>
          <div className="text-[10px] text-zinc-500">Avg revisions/task</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-300 tabular-nums">{stats.approvalRate}%</div>
          <div className="text-[10px] text-zinc-500">Approval rate</div>
        </div>
      </div>
      {stats.redoCount > 0 && (
        <div className="mt-2 text-[11px] text-red-400">
          {stats.redoCount} redo task{stats.redoCount !== 1 ? 's' : ''} created
        </div>
      )}
    </div>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────────────

function TaskTimeline({ tasks }: { tasks: Task[] }) {
  const timelineData = useMemo(() => {
    return tasks
      .filter((t) => t.started_at || t.completed_at)
      .sort((a, b) => {
        const aTime = Date.parse(a.started_at || a.created_at);
        const bTime = Date.parse(b.started_at || b.created_at);
        return aTime - bTime;
      })
      .slice(0, 12);
  }, [tasks]);

  if (timelineData.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Timeline</div>
        <div className="text-xs text-zinc-600">No task activity yet.</div>
      </div>
    );
  }

  const statusDotColor: Record<string, string> = {
    todo: 'bg-zinc-500',
    blocked: 'bg-rose-500',
    in_progress: 'bg-amber-500',
    review: 'bg-purple-500',
    done: 'bg-emerald-500',
    failed: 'bg-red-500',
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Task Timeline</div>
      <div className="space-y-0">
        {timelineData.map((task, i) => {
          const agent = getAgent(task.primary_agent_id);
          const startedAt = task.started_at ? new Date(task.started_at) : null;
          const completedAt = task.completed_at ? new Date(task.completed_at) : null;
          const durationMs = startedAt && completedAt
            ? completedAt.getTime() - startedAt.getTime()
            : null;
          const durationStr = durationMs !== null
            ? durationMs < 60_000
              ? `${Math.round(durationMs / 1000)}s`
              : `${Math.round(durationMs / 60_000)}m`
            : null;

          return (
            <div key={task.id} className="flex items-start gap-3 relative">
              {/* Vertical connector line */}
              <div className="flex flex-col items-center flex-shrink-0 w-4">
                <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor[task.status] || 'bg-zinc-500'} mt-1 z-10 flex-shrink-0`} />
                {i < timelineData.length - 1 && (
                  <div className="w-px flex-1 bg-zinc-800 min-h-[20px]" />
                )}
              </div>
              <div className="flex-1 pb-3 min-w-0">
                <div className="flex items-center gap-2">
                  {agent && <span className="text-[11px]" title={`${agent.name} — ${agent.role}`}>{agent.emoji}</span>}
                  <span className="text-xs text-zinc-200 truncate">{task.title}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {startedAt && (
                    <span className="text-[10px] text-zinc-600">
                      {startedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {durationStr && (
                    <span className="text-[10px] text-zinc-500">({durationStr})</span>
                  )}
                  <span className="text-[10px] text-zinc-600">{task.status}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Connection Health ──────────────────────────────────────────────────────

function ConnectionHealth() {
  const quality = useMissionControlStore((s) => s.connectionQuality);
  const reconnecting = useMissionControlStore((s) => s.reconnecting);

  const indicator = quality === 'good'
    ? { color: 'bg-emerald-400', label: 'Connected', textColor: 'text-emerald-300' }
    : quality === 'degraded'
    ? { color: 'bg-amber-400 animate-pulse', label: 'Degraded', textColor: 'text-amber-300' }
    : { color: 'bg-red-400 animate-pulse', label: 'Disconnected', textColor: 'text-red-300' };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Connection</div>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${indicator.color}`} />
        <span className={`text-sm font-medium ${indicator.textColor}`}>{indicator.label}</span>
      </div>
      {reconnecting && (
        <div className="text-[11px] text-amber-400 mt-1">Reconnection in progress...</div>
      )}
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export function MissionDashboard() {
  const missions = useMissionControlStore((s) => s.missions);
  const tasks = useMissionControlStore((s) => s.tasks);
  const filter = useMissionControlStore((s) => s.filter);

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      if (filter.team !== 'all') {
        const agentDef = AGENTS.find((a) => a.id === m.agent_id);
        if (agentDef && agentDef.team !== filter.team) return false;
      }
      if (filter.agent && m.agent_id !== filter.agent) return false;
      return true;
    });
  }, [missions, filter]);

  const allTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter.team !== 'all') {
        const agentDef = AGENTS.find((a) => a.id === t.primary_agent_id);
        if (agentDef && agentDef.team !== filter.team) return false;
      }
      if (filter.agent && t.primary_agent_id !== filter.agent) return false;
      return true;
    });
  }, [tasks, filter]);

  // Stat counts
  const missionStats = useMemo(() => {
    const total = filteredMissions.length;
    const active = filteredMissions.filter(
      (m) => m.status === 'in_progress' || m.status === 'assigned',
    ).length;
    const inReview = filteredMissions.filter((m) => m.status === 'pending_review').length;
    const completed = filteredMissions.filter((m) => m.status === 'done').length;
    const failed = filteredMissions.filter((m) => m.status === 'failed').length;
    return { total, active, inReview, completed, failed };
  }, [filteredMissions]);

  const tasksByMission = useMemo(() => {
    const map = new Map<string, Task[]>();
    allTasks.forEach((task) => {
      const missionId = task.root_task_id || task.id;
      if (missionId === task.id) return; // skip root task itself
      const list = map.get(missionId) ?? [];
      list.push(task);
      map.set(missionId, list);
    });
    return map;
  }, [allTasks]);

  // Agent utilization
  const agentData = useMemo(() => {
    return AGENTS.map((agent) => {
      const agentTasks = allTasks.filter((t) => t.primary_agent_id === agent.id);
      const currentTask = agentTasks.find(
        (t) => t.status === 'in_progress' || t.status === 'review',
      ) || null;
      const queueCount = agentTasks.filter(
        (t) => t.status === 'todo' || t.status === 'blocked',
      ).length;
      const completedCount = agentTasks.filter((t) => t.status === 'done').length;
      return { agent, currentTask, queueCount, completedCount };
    }).filter((d) => {
      if (filter.team !== 'all' && d.agent.team !== filter.team) return false;
      if (filter.agent && d.agent.id !== filter.agent) return false;
      return true;
    });
  }, [allTasks, filter]);

  // Missions with tasks, sorted by activity
  const missionsWithProgress = useMemo(() => {
    return filteredMissions
      .filter((m) => {
        const phase = m.mission_phase || 'tasks';
        const phaseStatus = m.mission_phase_status || 'approved';
        return phase === 'tasks' && phaseStatus === 'approved';
      })
      .sort((a, b) => {
        const aActive = (tasksByMission.get(a.id) ?? []).some(
          (t) => t.status === 'in_progress' || t.status === 'review',
        );
        const bActive = (tasksByMission.get(b.id) ?? []).some(
          (t) => t.status === 'in_progress' || t.status === 'review',
        );
        if (aActive !== bActive) return aActive ? -1 : 1;
        return Date.parse(b.updated_at) - Date.parse(a.updated_at);
      });
  }, [filteredMissions, tasksByMission]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-5">
      {/* Summary stats row */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Total Missions" value={missionStats.total} color="zinc" />
        <StatCard label="Active" value={missionStats.active} color="amber" />
        <StatCard label="In Review" value={missionStats.inReview} color="purple" />
        <StatCard label="Completed" value={missionStats.completed} color="green" />
        <StatCard label="Failed" value={missionStats.failed} color="red" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left column: Mission progress */}
        <div className="col-span-2 space-y-4">
          {/* Mission progress bars */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Mission Progress</div>
            {missionsWithProgress.length === 0 ? (
              <div className="text-xs text-zinc-600">No active missions.</div>
            ) : (
              <div className="space-y-2">
                {missionsWithProgress.map((mission) => (
                  <MissionProgress
                    key={mission.id}
                    mission={mission}
                    missionTasks={tasksByMission.get(mission.id) ?? []}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Agent utilization */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Agent Utilization</div>
            <div className="space-y-1.5">
              {agentData.map(({ agent, currentTask, queueCount, completedCount }) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  currentTask={currentTask}
                  queueCount={queueCount}
                  completedCount={completedCount}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Review + Timeline + Connection */}
        <div className="space-y-4">
          <ConnectionHealth />
          <ReviewStats tasks={allTasks} />
          <TaskTimeline tasks={allTasks} />
        </div>
      </div>
    </div>
  );
}
