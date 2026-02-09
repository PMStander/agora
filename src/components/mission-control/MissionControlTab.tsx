import { useEffect, useMemo, useState } from 'react';
import { KanbanBoard } from './KanbanBoard';
import { DependencyDag } from './DependencyDag';
import { MissionDashboard } from './MissionDashboard';
import { MissionFlowDiagram } from './MissionFlowDiagram';
import { CreateMissionModal } from './CreateMissionModal';
import { LaunchOperationWizard } from './LaunchOperationWizard';
import { MissionStatementModal } from './MissionStatementModal';
import { PlanningCenterModal } from './PlanningCenterModal';
import { ActivityFeed } from './ActivityFeed';
import { ThinkingStream } from './ThinkingStream';
import { MissionApprovalPanel } from './MissionApprovalPanel';
import { PermissionOverridePanel } from '../agents/PermissionOverridePanel';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore } from '../../stores/missionControl';

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function MissionLaunchCountdown() {
  const schedulerNextTickAt = useMissionControlStore((s) => s.schedulerNextTickAt);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const fallbackNextTickMs = useMemo(() => {
    const nextMinute = new Date(nowMs);
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    return nextMinute.getTime();
  }, [nowMs]);

  const nextTickMs = schedulerNextTickAt
    ? Date.parse(schedulerNextTickAt)
    : fallbackNextTickMs;
  const remainingSeconds = Math.max(0, Math.ceil((nextTickMs - nowMs) / 1000));
  const launching = remainingSeconds === 0;

  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-800/80 border border-zinc-700 text-xs">
      <span className={launching ? 'animate-pulse' : ''}>🚀</span>
      <span className="text-zinc-400">Mission Launch</span>
      <span className={launching ? 'text-amber-300 font-semibold' : 'text-amber-400 font-semibold'}>
        {launching ? 'launching…' : formatCountdown(remainingSeconds)}
      </span>
    </div>
  );
}

function ConnectionBanner() {
  const reconnecting = useMissionControlStore((s) => s.reconnecting);
  const connectionQuality = useMissionControlStore((s) => s.connectionQuality);
  const tasks = useMissionControlStore((s) => s.tasks);

  if (!reconnecting && connectionQuality === 'good') return null;

  const affectedTasks = tasks.filter((task) => {
    const isRunning = task.status === 'in_progress' || task.status === 'review';
    return isRunning && task.active_run_id;
  });

  return (
    <div className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 flex items-center gap-3 text-sm">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      <span className="text-amber-300 font-medium">
        {reconnecting ? 'Reconnecting to OpenClaw...' : 'Connection degraded'}
      </span>
      {affectedTasks.length > 0 && (
        <span className="text-amber-400/70">
          {affectedTasks.length} mission{affectedTasks.length === 1 ? '' : 's'} affected
        </span>
      )}
      <span className="text-zinc-500 text-xs ml-auto">
        Missions protected by 5-minute grace period
      </span>
    </div>
  );
}

function StuckMissionsAlert() {
  const tasks = useMissionControlStore((s) => s.tasks);
  const missions = useMissionControlStore((s) => s.missions);
  const { moveMission } = useMissionControl();
  const [isForcing, setIsForcing] = useState<string | null>(null);

  // Find missions that appear stuck (ready/blocked for >2 min with no active run)
  const now = Date.now();
  const stuckMissions = useMemo(() => {
    return missions.filter((mission) => {
      const runtimeStatus = mission.mission_status || mission.status;
      if (runtimeStatus !== 'assigned' && runtimeStatus !== 'scheduled' && runtimeStatus !== 'revision') {
        return false;
      }
      // Check if mission has any tasks that should be running but aren't
      const missionTasks = tasks.filter((t) => (t.root_task_id || t.id) === mission.id);
      const pendingTasks = missionTasks.filter((t) => 
        (t.status === 'todo' || t.status === 'blocked') && 
        !t.active_run_id &&
        Date.parse(t.updated_at) < now - 120_000 // Stuck for 2+ minutes
      );
      return pendingTasks.length > 0;
    }).slice(0, 3); // Show max 3
  }, [missions, tasks, now]);

  if (stuckMissions.length === 0) return null;

  const handleForceStart = async (missionId: string) => {
    setIsForcing(missionId);
    try {
      await moveMission(missionId, 'in_progress');
    } finally {
      setIsForcing(null);
    }
  };

  return (
    <div className="px-4 py-2 border-b border-amber-500/30 bg-amber-500/10">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-amber-300 font-medium">
          {stuckMissions.length} mission{stuckMissions.length > 1 ? 's' : ''} may be stuck
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {stuckMissions.map((m) => (
            <button
              key={m.id}
              onClick={() => handleForceStart(m.id)}
              disabled={isForcing === m.id}
              className="px-2 py-1 text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded hover:bg-amber-500/30 disabled:opacity-50"
            >
              {isForcing === m.id ? 'Starting...' : `Force start: ${m.title.slice(0, 20)}${m.title.length > 20 ? '...' : ''}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MissionControlTab() {
  const { isConfigured } = useMissionControl();
  const { setCreateModalOpen, setOperationWizardOpen, filter, setFilter, requestSchedulerTick, realtimeLastEvent, realtimeStatus, missions } = useMissionControlStore();
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [planningCenterOpen, setPlanningCenterOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'dependencies' | 'dashboard' | 'flow'>('board');
  const planningQueueCount = useMemo(() => missions.filter((mission) => {
    const phase = mission.mission_phase || 'tasks';
    const phaseStatus = mission.mission_phase_status || 'approved';
    return phase !== 'tasks' || phaseStatus !== 'approved';
  }).length, [missions]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-zinc-100">Mission Control</h1>
          {!isConfigured && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Local Mode
            </span>
          )}
          <MissionLaunchCountdown />
          {(realtimeStatus || realtimeLastEvent) && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Realtime: {realtimeStatus ?? '—'}{realtimeLastEvent ? ` • ${realtimeLastEvent}` : ''}
            </span>
          )}
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filter.team}
              onChange={(e) => setFilter({ team: e.target.value as any })}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
            >
              <option value="all">All Teams</option>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
            {(['board', 'dependencies', 'dashboard', 'flow'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-xs rounded ${viewMode === mode
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'board' ? 'Board' : mode === 'dependencies' ? 'DAG' : mode === 'dashboard' ? 'Dashboard' : 'Flow'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={requestSchedulerTick}
            className="p-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-500 transition-colors"
            title="Run scheduler tick now"
            aria-label="Run scheduler tick now"
          >
            ▶️
          </button>
          <button
            onClick={() => setStatementModalOpen(true)}
            className="p-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-500 transition-colors"
            title="Mission statement"
            aria-label="Mission statement"
          >
            📝
          </button>
          <button
            onClick={() => setPlanningCenterOpen(true)}
            className="p-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-500 transition-colors"
            title={`Planning Center${planningQueueCount > 0 ? ` (${planningQueueCount})` : ''}`}
            aria-label="Planning Center"
          >
            🗂️
          </button>
          <button
            onClick={() => setActivityOpen((prev) => !prev)}
            className="p-2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-500 transition-colors"
            title={activityOpen ? 'Hide activity panel' : 'Show activity panel'}
            aria-label={activityOpen ? 'Hide activity panel' : 'Show activity panel'}
          >
            {activityOpen ? '👁️' : '🙈'}
          </button>
          <button
            onClick={() => setOperationWizardOpen(true)}
            className="px-3 py-2 bg-zinc-800 border border-amber-500/50 text-amber-300 text-sm font-medium rounded-lg hover:bg-amber-500/10 hover:border-amber-500 transition-colors flex items-center gap-1.5"
            title="Launch Operation (⌘⇧N)"
            aria-label="Launch Operation"
          >
            🚀 Launch
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="p-2 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
            title="New mission"
            aria-label="New mission"
          >
            ➕
          </button>
        </div>
      </div>

      {/* Connection banner */}
      <ConnectionBanner />

      {/* Mission approval requests */}
      <MissionApprovalPanel />

      {/* Stuck missions alert */}
      <StuckMissionsAlert />

      {/* Pending level transition approvals */}
      <PermissionOverridePanel />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main board / DAG / Dashboard / Flow */}
        <div className="flex-1 overflow-hidden py-4">
          {viewMode === 'board' && <KanbanBoard />}
          {viewMode === 'dependencies' && <DependencyDag />}
          {viewMode === 'dashboard' && <MissionDashboard />}
          {viewMode === 'flow' && <MissionFlowDiagram />}
        </div>

        {/* Activity sidebar */}
        {activityOpen && (
          <div className="w-80 border-l border-zinc-800 flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400">Activity</h2>
              <button
                onClick={() => setActivityOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
                title="Collapse Activity"
              >
                Hide
              </button>
            </div>
            <div className="flex-1 overflow-y-auto border-b border-zinc-800">
              <ActivityFeed limit={20} />
            </div>

            {/* Thinking Stream - Live agent reasoning */}
            <div className="flex-none max-h-64 flex flex-col">
              <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <h2 className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Live Thinking
                </h2>
                <button
                  onClick={() => setThinkingOpen((v) => !v)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {thinkingOpen ? 'Hide' : 'Show'}
                </button>
              </div>
              {thinkingOpen && (
                <div className="flex-1 overflow-y-auto">
                  <ThinkingStream />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateMissionModal />
      <LaunchOperationWizard />
      <MissionStatementModal isOpen={statementModalOpen} onClose={() => setStatementModalOpen(false)} />
      <PlanningCenterModal isOpen={planningCenterOpen} onClose={() => setPlanningCenterOpen(false)} />
    </div>
  );
}
