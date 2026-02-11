import { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useProjects } from '../../hooks/useProjects';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore } from '../../stores/missionControl';
import { KanbanColumn } from '../mission-control/KanbanColumn';
import { MissionCard } from '../mission-control/MissionCard';
import { getAgent, MISSION_COLUMNS } from '../../types/supabase';
import type { Mission, MissionStatus } from '../../types/supabase';
import type { Project } from '../../stores/projects';
import { CreateProjectMissionModal } from './CreateProjectMissionModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusBadgeColors: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-300',
  blue: 'bg-blue-500/20 text-blue-300',
  amber: 'bg-amber-500/20 text-amber-300',
  green: 'bg-emerald-500/20 text-emerald-300',
  purple: 'bg-purple-500/20 text-purple-300',
  orange: 'bg-orange-500/20 text-orange-300',
  red: 'bg-red-500/20 text-red-300',
};

type BoardColumnId =
  | 'planning'
  | 'queued'
  | 'ready'
  | 'in_progress'
  | 'pending_review'
  | 'done'
  | 'failed';

const BOARD_COLUMNS: Array<{ id: BoardColumnId; title: string; color: string }> = [
  { id: 'planning', title: '\uD83D\uDCDD Planning', color: 'purple' },
  { id: 'queued', title: '\uD83D\uDCC5 Queued', color: 'zinc' },
  { id: 'ready', title: '\uD83E\uDDE9 Ready', color: 'blue' },
  { id: 'in_progress', title: '\uD83D\uDD04 In Progress', color: 'amber' },
  { id: 'pending_review', title: '\uD83D\uDC41\uFE0F Review', color: 'orange' },
  { id: 'done', title: '\u2705 Done', color: 'green' },
  { id: 'failed', title: '\u274C Failed', color: 'red' },
];

const COLUMN_TO_STATUS: Partial<Record<BoardColumnId, MissionStatus>> = {
  queued: 'scheduled',
  ready: 'assigned',
  in_progress: 'in_progress',
  pending_review: 'pending_review',
  done: 'done',
  failed: 'failed',
};

function isPlanningMission(mission: Mission): boolean {
  const phase = mission.mission_phase || 'tasks';
  const phaseStatus = mission.mission_phase_status || 'approved';
  return phase !== 'tasks' || phaseStatus !== 'approved';
}

function getMissionColumnId(mission: Mission, nowMs: number): BoardColumnId {
  if (isPlanningMission(mission)) return 'planning';
  const runtimeStatus = mission.mission_status || mission.status;
  if (runtimeStatus === 'in_progress') return 'in_progress';
  if (runtimeStatus === 'pending_review') return 'pending_review';
  if (runtimeStatus === 'done') return 'done';
  if (runtimeStatus === 'failed') return 'failed';
  if (runtimeStatus === 'assigned' || runtimeStatus === 'revision') return 'ready';
  const dueMs = Date.parse(mission.scheduled_at || '');
  if (Number.isFinite(dueMs) && dueMs <= nowMs) return 'ready';
  return 'queued';
}

function missionStatusBadge(status: string): string {
  const col = MISSION_COLUMNS.find((c) => c.id === status);
  if (!col) return statusBadgeColors.zinc;
  return statusBadgeColors[col.color] ?? statusBadgeColors.zinc;
}

function missionStatusLabel(status: string): string {
  const col = MISSION_COLUMNS.find((c) => c.id === status);
  return col ? col.title : status;
}

// ─── Component ──────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'kanban';

interface Props {
  project: Project;
}

export function ProjectWorkspaceMissions({ project }: Props) {
  const { linkMissionToProject, unlinkMission } = useProjects();
  const { moveMission } = useMissionControl();
  const allMissions = useMissionControlStore((s) => s.missions);
  const selectMission = useMissionControlStore((s) => s.selectMission);

  const [view, setView] = useState<ViewMode>('list');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);

  // Linked missions
  const linkedMissions = useMemo(() => {
    const ids = project.mission_ids || [];
    return allMissions.filter((m) => ids.includes(m.id));
  }, [project.mission_ids, allMissions]);

  // Unlinked missions (for link modal)
  const unlinkableMissions = useMemo(() => {
    const ids = new Set(project.mission_ids || []);
    return allMissions.filter((m) => !ids.has(m.id));
  }, [project.mission_ids, allMissions]);

  // Group by status for list view
  const groupedMissions = useMemo(() => {
    const groups: Record<string, Mission[]> = {};
    const statusOrder = ['in_progress', 'assigned', 'scheduled', 'pending_review', 'revision', 'done', 'failed'];
    for (const status of statusOrder) groups[status] = [];
    for (const m of linkedMissions) {
      const s = m.mission_status || m.status;
      if (!groups[s]) groups[s] = [];
      groups[s].push(m);
    }
    return Object.entries(groups).filter(([, arr]) => arr.length > 0);
  }, [linkedMissions]);

  // Kanban: bucket missions into columns
  const columnMissions = useMemo(() => {
    const nowMs = Date.now();
    const buckets: Record<BoardColumnId, Mission[]> = {
      planning: [],
      queued: [],
      ready: [],
      in_progress: [],
      pending_review: [],
      done: [],
      failed: [],
    };
    for (const m of linkedMissions) {
      buckets[getMissionColumnId(m, nowMs)].push(m);
    }
    return buckets;
  }, [linkedMissions]);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const mission = linkedMissions.find((m) => m.id === event.active.id);
    setActiveMission(mission || null);
  }, [linkedMissions]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveMission(null);
      const { active, over } = event;
      if (!over) return;
      const columnId = over.id as BoardColumnId;
      const newStatus = COLUMN_TO_STATUS[columnId];
      if (!newStatus) return;
      const mission = linkedMissions.find((m) => m.id === active.id);
      if (!mission) return;
      const currentStatus = mission.mission_status || mission.status;
      if (currentStatus !== newStatus) {
        moveMission(mission.id, newStatus);
      }
    },
    [linkedMissions, moveMission]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          Missions ({linkedMissions.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-2.5 py-1 text-xs bg-amber-500 text-black rounded hover:bg-amber-400 transition-colors"
          >
            + Create
          </button>
          <button
            onClick={() => setLinkModalOpen(true)}
            className="px-2.5 py-1 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500 transition-colors"
          >
            Link
          </button>
          <div className="flex bg-zinc-800 rounded border border-zinc-700 overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-2 py-1 text-[10px] ${
                view === 'list' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-2 py-1 text-[10px] ${
                view === 'kanban' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500'
              }`}
            >
              Board
            </button>
          </div>
        </div>
      </div>

      {linkedMissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-zinc-500 text-sm">No missions linked</p>
          <p className="text-zinc-600 text-xs mt-1">
            Create or link missions to track work
          </p>
        </div>
      ) : view === 'list' ? (
        /* ─── List View ─── */
        <div className="space-y-4">
          {groupedMissions.map(([status, missions]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${missionStatusBadge(status)}`}
                >
                  {missionStatusLabel(status)}
                </span>
                <span className="text-[10px] text-zinc-600">{missions.length}</span>
              </div>
              <div className="space-y-1">
                {missions.map((mission) => {
                  const agent = getAgent(mission.agent_id);
                  return (
                    <div
                      key={mission.id}
                      className="flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 hover:border-zinc-700 transition-colors cursor-pointer"
                      onClick={() => selectMission(mission.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {agent && <span className="text-sm shrink-0" title={`${agent.name} — ${agent.role}`}>{agent.emoji}</span>}
                        <span className="text-xs text-zinc-300 truncate">{mission.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {mission.priority === 'urgent' && (
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                        )}
                        {mission.priority === 'high' && (
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            unlinkMission(project.id, mission.id);
                          }}
                          className="text-xs text-zinc-600 hover:text-red-400"
                          title="Unlink"
                        >
                          {'\u2715'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── Kanban View ─── */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-2 overflow-x-auto pb-2">
            {BOARD_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                color={col.color}
                missions={columnMissions[col.id]}
              />
            ))}
          </div>
          <DragOverlay>
            {activeMission ? <MissionCard mission={activeMission} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Link Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Link Mission to Project</h3>
              <button
                onClick={() => setLinkModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                {'\u2715'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {unlinkableMissions.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">
                  No unlinked missions available.
                </p>
              ) : (
                unlinkableMissions.map((mission) => (
                  <button
                    key={mission.id}
                    onClick={async () => {
                      await linkMissionToProject(project.id, mission.id);
                    }}
                    className="w-full text-left flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 hover:border-amber-500/50 transition-colors"
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${missionStatusBadge(
                        mission.status
                      )}`}
                    >
                      {missionStatusLabel(mission.status)}
                    </span>
                    <span className="text-xs text-zinc-300 truncate">{mission.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Mission Modal */}
      {createModalOpen && (
        <CreateProjectMissionModal
          projectId={project.id}
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </div>
  );
}
