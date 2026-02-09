import { useCallback, useMemo, useRef, useState } from 'react';
import type { Task } from '../../types/supabase';
import { getAgent } from '../../types/supabase';
import { useMissionControlStore, useSelectedMission } from '../../stores/missionControl';

interface DagNode {
  task: Task;
  level: number;
  columnIndex: number;
  x: number;
  y: number;
}

interface DagEdge {
  from: DagNode;
  to: DagNode;
  isCritical: boolean;
}

const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 110;
const NODE_WIDTH = 240;
const NODE_HEIGHT = 80;
const PADDING = 40;

const statusColors: Record<string, { fill: string; stroke: string; text: string; glow: string }> = {
  todo: { fill: '#27272a', stroke: '#3f3f46', text: '#a1a1aa', glow: '' },
  blocked: { fill: '#1c0a0e', stroke: '#be123c', text: '#fda4af', glow: 'rgba(190,18,60,0.15)' },
  in_progress: { fill: '#1a1400', stroke: '#f59e0b', text: '#fcd34d', glow: 'rgba(245,158,11,0.2)' },
  review: { fill: '#1a0a2e', stroke: '#a855f7', text: '#c4b5fd', glow: 'rgba(168,85,247,0.15)' },
  done: { fill: '#052e16', stroke: '#22c55e', text: '#86efac', glow: 'rgba(34,197,94,0.15)' },
  failed: { fill: '#1c0a0a', stroke: '#ef4444', text: '#fca5a5', glow: 'rgba(239,68,68,0.15)' },
};

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const dueDiff = Date.parse(a.due_at || '') - Date.parse(b.due_at || '');
    if (Number.isFinite(dueDiff) && dueDiff !== 0) return dueDiff;
    return a.title.localeCompare(b.title);
  });
}

function buildDag(tasks: Task[]) {
  const nodesById = new Map<string, Task>();
  tasks.forEach((task) => nodesById.set(task.id, task));

  const dependencyMap = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  tasks.forEach((task) => {
    const deps = (task.dependency_task_ids || []).filter((id) => nodesById.has(id));
    dependencyMap.set(task.id, deps);
    indegree.set(task.id, deps.length);
    deps.forEach((depId) => {
      const list = dependents.get(depId) ?? [];
      list.push(task.id);
      dependents.set(depId, list);
    });
  });

  const queue = sortTasks(tasks.filter((task) => (indegree.get(task.id) ?? 0) === 0));
  const topo: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    topo.push(node.id);
    const outgoing = dependents.get(node.id) ?? [];
    outgoing.forEach((next) => {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if ((indegree.get(next) ?? 0) === 0) {
        const nextTask = nodesById.get(next);
        if (nextTask) {
          queue.push(nextTask);
          queue.sort((a, b) => a.title.localeCompare(b.title));
        }
      }
    });
  }

  if (topo.length < tasks.length) {
    const remaining = tasks.filter((task) => !topo.includes(task.id));
    remaining.forEach((task) => topo.push(task.id));
  }

  const levelById = new Map<string, number>();
  topo.forEach((taskId) => {
    const deps = dependencyMap.get(taskId) ?? [];
    const level = deps.reduce((acc, depId) => {
      const depLevel = levelById.get(depId) ?? 0;
      return Math.max(acc, depLevel + 1);
    }, 0);
    levelById.set(taskId, level);
  });

  const maxLevel = Math.max(0, ...Array.from(levelById.values()));
  const columns: Task[][] = Array.from({ length: maxLevel + 1 }, () => []);
  topo.forEach((taskId) => {
    const task = nodesById.get(taskId);
    if (!task) return;
    const level = levelById.get(taskId) ?? 0;
    columns[level].push(task);
  });

  const nodes: DagNode[] = [];
  columns.forEach((columnTasks, level) => {
    const ordered = sortTasks(columnTasks);
    ordered.forEach((task, index) => {
      nodes.push({
        task,
        level,
        columnIndex: index,
        x: PADDING + level * COLUMN_WIDTH,
        y: PADDING + index * ROW_HEIGHT,
      });
    });
  });

  const distance = new Map<string, number>();
  const previous = new Map<string, string | null>();

  topo.forEach((taskId) => {
    const deps = dependencyMap.get(taskId) ?? [];
    let best = -1;
    let bestDep: string | null = null;
    deps.forEach((depId) => {
      const candidate = (distance.get(depId) ?? 0) + 1;
      if (candidate > best) {
        best = candidate;
        bestDep = depId;
      }
    });
    distance.set(taskId, Math.max(best, 0));
    previous.set(taskId, bestDep);
  });

  let endNode: string | null = null;
  let maxDistance = -1;
  distance.forEach((value, taskId) => {
    if (value > maxDistance) {
      maxDistance = value;
      endNode = taskId;
    }
  });

  const criticalNodes = new Set<string>();
  const criticalEdges = new Set<string>();
  let current: string | null = endNode;
  while (current) {
    criticalNodes.add(current);
    const prev = previous.get(current);
    if (prev) criticalEdges.add(`${prev}->${current}`);
    current = prev ?? null;
  }

  const nodeById = new Map(nodes.map((node) => [node.task.id, node]));
  const edges: DagEdge[] = [];
  nodes.forEach((node) => {
    const deps = dependencyMap.get(node.task.id) ?? [];
    deps.forEach((depId) => {
      const fromNode = nodeById.get(depId);
      if (!fromNode) return;
      const edgeKey = `${depId}->${node.task.id}`;
      edges.push({
        from: fromNode,
        to: node,
        isCritical: criticalEdges.has(edgeKey),
      });
    });
  });

  return {
    nodes,
    edges,
    columns,
    criticalNodes,
    criticalPathLength: maxDistance + 1,
    width: PADDING * 2 + (maxLevel + 1) * COLUMN_WIDTH,
    height: PADDING * 2 + Math.max(...columns.map((column) => column.length), 1) * ROW_HEIGHT,
  };
}

function MiniMap({
  dag,
  viewBox,
  containerWidth,
  containerHeight,
}: {
  dag: ReturnType<typeof buildDag>;
  viewBox: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
}) {
  const MINIMAP_W = 160;
  const scale = MINIMAP_W / dag.width;
  const miniH = Math.max(60, dag.height * scale);

  const vpW = containerWidth * scale;
  const vpH = containerHeight * scale;
  const vpX = -viewBox.x * scale;
  const vpY = -viewBox.y * scale;

  return (
    <div className="absolute bottom-3 right-3 rounded border border-zinc-700 bg-zinc-900/90 overflow-hidden"
      style={{ width: MINIMAP_W, height: miniH }}
    >
      <svg width={MINIMAP_W} height={miniH} viewBox={`0 0 ${MINIMAP_W} ${miniH}`}>
        {dag.edges.map((edge, i) => (
          <line
            key={i}
            x1={(edge.from.x + NODE_WIDTH) * scale}
            y1={(edge.from.y + NODE_HEIGHT / 2) * scale}
            x2={edge.to.x * scale}
            y2={(edge.to.y + NODE_HEIGHT / 2) * scale}
            stroke={edge.isCritical ? '#f59e0b' : '#3f3f46'}
            strokeWidth={0.5}
          />
        ))}
        {dag.nodes.map((node) => {
          const colors = statusColors[node.task.status] || statusColors.todo;
          return (
            <rect
              key={node.task.id}
              x={node.x * scale}
              y={node.y * scale}
              width={NODE_WIDTH * scale}
              height={NODE_HEIGHT * scale}
              fill={colors.stroke}
              rx={2}
              opacity={0.8}
            />
          );
        })}
        <rect
          x={vpX}
          y={vpY}
          width={vpW}
          height={vpH}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.5}
          rx={1}
          opacity={0.7}
        />
      </svg>
    </div>
  );
}

export function DependencyDag() {
  const mission = useSelectedMission();
  const tasks = useMissionControlStore((s) => s.tasks);
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const selectedTaskId = useMissionControlStore((s) => s.selectedTaskId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const missionTasks = useMemo(() => {
    if (!mission) return [] as Task[];
    return tasks.filter((task) => (task.root_task_id || task.id) === mission.id && task.id !== mission.id);
  }, [mission, tasks]);

  const dag = useMemo(() => {
    if (missionTasks.length === 0) return null;
    return buildDag(missionTasks);
  }, [missionTasks]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    missionTasks.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }, [missionTasks]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.3, Math.min(2, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitToView = useCallback(() => {
    if (!dag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / dag.width;
    const scaleY = rect.height / dag.height;
    const newZoom = Math.max(0.3, Math.min(1, Math.min(scaleX, scaleY) * 0.9));
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  }, [dag]);

  if (!mission) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        Select a mission to view dependency graph.
      </div>
    );
  }

  if (!dag) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        No tasks yet. Approve the mission plan to generate tasks.
      </div>
    );
  }

  const containerWidth = containerRef.current?.clientWidth ?? 800;
  const containerHeight = containerRef.current?.clientHeight ?? 600;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <div className="text-sm font-semibold text-zinc-200">Dependency DAG</div>
          <div className="text-xs text-zinc-500">{mission.title}</div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status legend */}
          <div className="flex items-center gap-2">
            {Object.entries(statusCounts).map(([status, count]) => {
              const colors = statusColors[status] || statusColors.todo;
              return (
                <span key={status} className="flex items-center gap-1 text-[10px]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.stroke }} />
                  <span style={{ color: colors.text }}>{status}</span>
                  <span className="text-zinc-600">{count}</span>
                </span>
              );
            })}
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-xs text-zinc-500">Tasks: {missionTasks.length}</span>
          <span className="text-xs text-zinc-500">Critical path: {dag.criticalPathLength}</span>
          <span className="text-zinc-700">|</span>
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
              className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-500 flex items-center justify-center"
              title="Zoom out"
            >-</button>
            <span className="text-xs text-zinc-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
              className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs hover:border-zinc-500 flex items-center justify-center"
              title="Zoom in"
            >+</button>
            <button
              onClick={fitToView}
              className="px-2 h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] hover:border-zinc-500"
              title="Fit to view"
            >Fit</button>
            <button
              onClick={resetView}
              className="px-2 h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] hover:border-zinc-500"
              title="Reset view"
            >1:1</button>
          </div>
        </div>
      </div>

      {/* DAG canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-zinc-950 cursor-grab active:cursor-grabbing select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
          <defs>
            <pattern id="dag-grid" width="40" height="40" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x % 40}, ${pan.y % 40})`}>
              <circle cx="20" cy="20" r="0.5" fill="#3f3f46" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dag-grid)" />
        </svg>

        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: dag.width,
            height: dag.height,
            position: 'relative',
          }}
        >
          {/* SVG edges */}
          <svg
            className="absolute inset-0"
            width={dag.width}
            height={dag.height}
            style={{ pointerEvents: 'none' }}
          >
            <defs>
              <marker
                id="dag-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="8"
                refY="4"
                orient="auto"
              >
                <path d="M0,1 L8,4 L0,7 Z" fill="#3f3f46" />
              </marker>
              <marker
                id="dag-arrow-critical"
                markerWidth="8"
                markerHeight="8"
                refX="8"
                refY="4"
                orient="auto"
              >
                <path d="M0,1 L8,4 L0,7 Z" fill="#f59e0b" />
              </marker>
              <filter id="glow-amber">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {dag.edges.map((edge, index) => {
              const startX = edge.from.x + NODE_WIDTH;
              const startY = edge.from.y + NODE_HEIGHT / 2;
              const endX = edge.to.x;
              const endY = edge.to.y + NODE_HEIGHT / 2;
              const midX = startX + (endX - startX) / 2;
              const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
              const isHighlighted =
                hoveredNodeId === edge.from.task.id || hoveredNodeId === edge.to.task.id;
              return (
                <path
                  key={`${edge.from.task.id}-${edge.to.task.id}-${index}`}
                  d={path}
                  stroke={edge.isCritical ? '#f59e0b' : isHighlighted ? '#71717a' : '#3f3f46'}
                  strokeWidth={edge.isCritical ? 2.5 : isHighlighted ? 2 : 1}
                  fill="none"
                  markerEnd={edge.isCritical ? 'url(#dag-arrow-critical)' : 'url(#dag-arrow)'}
                  opacity={edge.isCritical ? 0.9 : isHighlighted ? 0.8 : 0.5}
                  filter={edge.isCritical ? 'url(#glow-amber)' : undefined}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {dag.nodes.map((node) => {
            const isCritical = dag.criticalNodes.has(node.task.id);
            const isSelected = selectedTaskId === node.task.id;
            const isActive = node.task.status === 'in_progress';
            const colors = statusColors[node.task.status] || statusColors.todo;
            const agent = getAgent(node.task.primary_agent_id);

            return (
              <button
                key={node.task.id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectTask(node.task.id);
                }}
                onMouseEnter={() => setHoveredNodeId(node.task.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className={`absolute rounded-lg border transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-950'
                    : ''
                } ${isActive ? 'animate-pulse-subtle' : ''}`}
                style={{
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  backgroundColor: colors.fill,
                  borderColor: isCritical ? '#f59e0b' : colors.stroke,
                  boxShadow: isCritical
                    ? '0 0 16px rgba(245,158,11,0.25)'
                    : colors.glow
                    ? `0 0 12px ${colors.glow}`
                    : 'none',
                }}
              >
                <div className="px-3 py-2 h-full flex flex-col justify-between">
                  {/* Top: title + agent */}
                  <div className="flex items-start gap-2">
                    {agent && (
                      <span className="text-sm flex-shrink-0 mt-0.5" title={`${agent.name} - ${agent.role}`}>
                        {agent.emoji}
                      </span>
                    )}
                    <span className="text-xs font-medium line-clamp-2" style={{ color: colors.text }}>
                      {node.task.title}
                    </span>
                  </div>
                  {/* Bottom: status + meta */}
                  <div className="flex items-center justify-between mt-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${colors.stroke}30`,
                        color: colors.text,
                      }}
                    >
                      {node.task.status}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {node.task.review_enabled && (
                        <span className="text-[10px] text-purple-400" title="Review enabled">R</span>
                      )}
                      {node.task.revision_round > 0 && (
                        <span className="text-[10px] text-orange-400">v{node.task.revision_round}</span>
                      )}
                      {node.task.dependency_task_ids.length > 0 && (
                        <span className="text-[10px] text-zinc-500">
                          {node.task.dependency_task_ids.length} dep{node.task.dependency_task_ids.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Mini-map */}
        <MiniMap
          dag={dag}
          viewBox={pan}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
        />
      </div>

      {/* Inline style for pulse animation */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
