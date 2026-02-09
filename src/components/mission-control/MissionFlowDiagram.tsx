import { useMemo } from 'react';
import { useMissionControlStore } from '../../stores/missionControl';
import { getAgent } from '../../types/supabase';
import type { Mission, Task } from '../../types/supabase';

// ─── Constants ──────────────────────────────────────────────────────────────

const phaseColors = {
  statement: { bg: '#1e1b4b', border: '#6366f1', text: '#a5b4fc' },
  plan: { bg: '#1a1400', border: '#f59e0b', text: '#fcd34d' },
  tasks: { bg: '#052e16', border: '#22c55e', text: '#86efac' },
};

const statusDot: Record<string, string> = {
  draft: '#71717a',
  awaiting_approval: '#f59e0b',
  approved: '#22c55e',
};

const taskStatusColor: Record<string, { dot: string; text: string }> = {
  todo: { dot: '#71717a', text: '#a1a1aa' },
  blocked: { dot: '#be123c', text: '#fda4af' },
  in_progress: { dot: '#f59e0b', text: '#fcd34d' },
  review: { dot: '#a855f7', text: '#c4b5fd' },
  done: { dot: '#22c55e', text: '#86efac' },
  failed: { dot: '#ef4444', text: '#fca5a5' },
};

// ─── Flow Node Sizing ───────────────────────────────────────────────────────

const PHASE_NODE_W = 180;
const PHASE_NODE_H = 60;
const TASK_NODE_W = 200;
const TASK_NODE_H = 44;
const H_GAP = 60;
const V_GAP = 14;
const FLOW_PADDING = 30;

// ─── Single Mission Flow ────────────────────────────────────────────────────

function MissionFlow({
  mission,
  missionTasks,
}: {
  mission: Mission;
  missionTasks: Task[];
}) {
  const selectMission = useMissionControlStore((s) => s.selectMission);
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const agent = getAgent(mission.agent_id);

  // Build revision chains: for each task, find linked_revision_task_id chains
  const revisionChains = useMemo(() => {
    const chains: Task[][] = [];
    const visited = new Set<string>();

    // Find root tasks (not a revision of another)
    const revisedTaskIds = new Set(
      missionTasks
        .filter((t) => t.linked_revision_task_id)
        .map((t) => t.linked_revision_task_id!),
    );

    missionTasks.forEach((task) => {
      // Only start chain from original (non-revision) tasks that have revisions
      if (visited.has(task.id)) return;
      if (revisedTaskIds.has(task.id)) return; // skip if this is a revision target

      const chain: Task[] = [task];
      visited.add(task.id);

      // Find tasks that are revisions of this task
      let current = task;
      let found = true;
      while (found) {
        found = false;
        for (const t of missionTasks) {
          if (!visited.has(t.id) && t.linked_revision_task_id === current.id) {
            chain.push(t);
            visited.add(t.id);
            current = t;
            found = true;
            break;
          }
        }
      }

      if (chain.length > 1) {
        chains.push(chain);
      }
    });
    return chains;
  }, [missionTasks]);

  // Review handoffs: tasks that have review_enabled and review_agent_id
  const reviewHandoffs = useMemo(() => {
    return missionTasks.filter(
      (t) => t.review_enabled && t.review_agent_id && t.primary_agent_id !== t.review_agent_id,
    );
  }, [missionTasks]);

  // Layout
  const phase = mission.mission_phase || 'tasks';
  const phaseStatus = mission.mission_phase_status || 'approved';
  const phases = ['statement', 'plan', 'tasks'] as const;
  const currentPhaseIdx = phases.indexOf(phase as any);

  const taskRows = Math.max(1, missionTasks.length);
  const tasksBlockH = taskRows * (TASK_NODE_H + V_GAP) - V_GAP;

  // Total SVG dimensions
  const svgW = FLOW_PADDING * 2 + 3 * PHASE_NODE_W + 2 * H_GAP;
  const svgH = FLOW_PADDING * 2 + Math.max(PHASE_NODE_H, tasksBlockH) + 20;

  // Phase node positions
  const phasePositions = phases.map((_, i) => ({
    x: FLOW_PADDING + i * (PHASE_NODE_W + H_GAP),
    y: FLOW_PADDING + Math.max(0, (tasksBlockH - PHASE_NODE_H) / 2),
  }));

  // Task node positions (right side, stacked)
  const taskPositions = missionTasks.map((_, i) => ({
    x: phasePositions[2].x,
    y: FLOW_PADDING + i * (TASK_NODE_H + V_GAP),
  }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Mission header */}
      <button
        onClick={() => {
          selectTask(null);
          selectMission(mission.id);
        }}
        className="w-full text-left px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {agent && <span className="text-sm">{agent.emoji}</span>}
          <span className="text-sm font-medium text-zinc-200">{mission.title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 ml-auto">
            {mission.status}
          </span>
        </div>
      </button>

      {/* SVG flow diagram */}
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block">
          <defs>
            <marker id="flow-arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
              <path d="M0,0.5 L6,3 L0,5.5 Z" fill="#52525b" />
            </marker>
            <marker id="flow-arrow-active" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
              <path d="M0,0.5 L6,3 L0,5.5 Z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Connector lines between phase nodes */}
          {[0, 1].map((i) => {
            const fromX = phasePositions[i].x + PHASE_NODE_W;
            const fromY = phasePositions[i].y + PHASE_NODE_H / 2;
            const toX = phasePositions[i + 1].x;
            const toY = phasePositions[i + 1].y + PHASE_NODE_H / 2;
            const isActive = i < currentPhaseIdx;
            const isCurrent = i === currentPhaseIdx - 1;
            return (
              <line
                key={i}
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke={isActive || isCurrent ? '#f59e0b' : '#3f3f46'}
                strokeWidth={isCurrent ? 2 : 1}
                markerEnd={isCurrent ? 'url(#flow-arrow-active)' : 'url(#flow-arrow)'}
                opacity={isActive ? 0.8 : 0.4}
              />
            );
          })}

          {/* Lines from tasks phase to individual tasks */}
          {missionTasks.length > 0 && taskPositions.map((pos, i) => {
            const fromX = phasePositions[2].x + PHASE_NODE_W / 2;
            const fromY = phasePositions[2].y + PHASE_NODE_H;
            const toX = pos.x + TASK_NODE_W / 2;
            const toY = pos.y;
            if (toY <= fromY) return null;
            return (
              <line
                key={`task-line-${i}`}
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                stroke="#3f3f46"
                strokeWidth={0.5}
                strokeDasharray="4,3"
                opacity={0.4}
              />
            );
          })}

          {/* Phase nodes */}
          {phases.map((p, i) => {
            const pos = phasePositions[i];
            const isActive = i === currentPhaseIdx;
            const isComplete = i < currentPhaseIdx;
            const colors = phaseColors[p];
            const dot = isActive ? statusDot[phaseStatus] : isComplete ? '#22c55e' : '#3f3f46';

            return (
              <g key={p}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={PHASE_NODE_W}
                  height={PHASE_NODE_H}
                  rx={8}
                  fill={isActive || isComplete ? colors.bg : '#18181b'}
                  stroke={isActive ? colors.border : isComplete ? `${colors.border}80` : '#27272a'}
                  strokeWidth={isActive ? 2 : 1}
                />
                {/* Status dot */}
                <circle cx={pos.x + 16} cy={pos.y + PHASE_NODE_H / 2} r={4} fill={dot} />
                {/* Phase label */}
                <text
                  x={pos.x + 28}
                  y={pos.y + PHASE_NODE_H / 2 - 6}
                  fill={isActive ? colors.text : isComplete ? `${colors.text}cc` : '#52525b'}
                  fontSize={12}
                  fontWeight={600}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </text>
                {/* Status text */}
                <text
                  x={pos.x + 28}
                  y={pos.y + PHASE_NODE_H / 2 + 10}
                  fill="#71717a"
                  fontSize={10}
                >
                  {isComplete ? 'Approved' : isActive ? phaseStatus : 'Pending'}
                </text>
              </g>
            );
          })}

          {/* Task nodes (only if in tasks phase) */}
          {missionTasks.map((task, i) => {
            const pos = taskPositions[i];
            if (!pos) return null;
            // Position tasks below the tasks phase node
            const yOffset = phasePositions[2].y + PHASE_NODE_H + 12;
            const taskY = yOffset + i * (TASK_NODE_H + V_GAP);
            const tc = taskStatusColor[task.status] || taskStatusColor.todo;
            const taskAgent = getAgent(task.primary_agent_id);

            return (
              <g
                key={task.id}
                className="cursor-pointer"
                onClick={() => selectTask(task.id)}
              >
                <rect
                  x={phasePositions[2].x + 10}
                  y={taskY}
                  width={TASK_NODE_W - 20}
                  height={TASK_NODE_H}
                  rx={6}
                  fill="#18181b"
                  stroke={tc.dot}
                  strokeWidth={1}
                  opacity={0.9}
                />
                <circle
                  cx={phasePositions[2].x + 22}
                  cy={taskY + TASK_NODE_H / 2}
                  r={3}
                  fill={tc.dot}
                />
                {taskAgent && (
                  <text
                    x={phasePositions[2].x + 30}
                    y={taskY + TASK_NODE_H / 2 + 4}
                    fontSize={11}
                  >
                    {taskAgent.emoji}
                  </text>
                )}
                <text
                  x={phasePositions[2].x + 44}
                  y={taskY + TASK_NODE_H / 2 + 3}
                  fill={tc.text}
                  fontSize={10}
                  fontWeight={500}
                >
                  {task.title.length > 22 ? task.title.slice(0, 22) + '...' : task.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Revision chains */}
      {revisionChains.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Revision Chains</div>
          {revisionChains.map((chain, ci) => (
            <div key={ci} className="flex items-center gap-1.5 mb-1.5">
              {chain.map((task, ti) => {
                const tc = taskStatusColor[task.status] || taskStatusColor.todo;
                return (
                  <span key={task.id} className="flex items-center gap-1">
                    {ti > 0 && <span className="text-zinc-600 text-[10px] mx-0.5">-&gt;</span>}
                    <button
                      onClick={() => selectTask(task.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded border hover:border-zinc-600 transition-colors"
                      style={{
                        borderColor: `${tc.dot}40`,
                        color: tc.text,
                        backgroundColor: `${tc.dot}10`,
                      }}
                    >
                      {task.title.length > 18 ? task.title.slice(0, 18) + '..' : task.title}
                      {task.revision_round > 0 && ` (R${task.revision_round})`}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Review handoffs */}
      {reviewHandoffs.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Review Handoffs</div>
          {reviewHandoffs.map((task) => {
            const primary = getAgent(task.primary_agent_id);
            const reviewer = task.review_agent_id ? getAgent(task.review_agent_id) : null;
            return (
              <div key={task.id} className="flex items-center gap-2 mb-1 text-[11px]">
                <span className="text-zinc-400 truncate max-w-[120px]">{task.title}</span>
                <span className="text-zinc-600">:</span>
                {primary && <span>{primary.emoji} {primary.name}</span>}
                <span className="text-purple-400">-&gt;</span>
                {reviewer && <span>{reviewer.emoji} {reviewer.name}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MissionFlowDiagram() {
  const missions = useMissionControlStore((s) => s.missions);
  const tasks = useMissionControlStore((s) => s.tasks);
  const filter = useMissionControlStore((s) => s.filter);

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      if (filter.team !== 'all') {
        const agentDef = getAgent(m.agent_id);
        if (agentDef && agentDef.team !== filter.team) return false;
      }
      if (filter.agent && m.agent_id !== filter.agent) return false;
      return true;
    });
  }, [missions, filter]);

  const tasksByMission = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const missionId = task.root_task_id || task.id;
      if (missionId === task.id) return;
      const list = map.get(missionId) ?? [];
      list.push(task);
      map.set(missionId, list);
    });
    return map;
  }, [tasks]);

  if (filteredMissions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        No missions to display. Create a mission to see the lifecycle flow.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">
        Mission Lifecycle Flows ({filteredMissions.length})
      </div>
      {filteredMissions.map((mission) => (
        <MissionFlow
          key={mission.id}
          mission={mission}
          missionTasks={tasksByMission.get(mission.id) ?? []}
        />
      ))}
    </div>
  );
}
