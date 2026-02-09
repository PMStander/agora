import { useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { MissionCard } from './MissionCard';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useFilteredMissions } from '../../stores/missionControl';
import type { Mission, MissionStatus } from '../../types/supabase';

type BoardColumnId =
  | 'planning'
  | 'queued'
  | 'ready'
  | 'in_progress'
  | 'pending_review'
  | 'done'
  | 'failed';

const BOARD_COLUMNS: Array<{ id: BoardColumnId; title: string; color: string }> = [
  { id: 'planning', title: '📝 Planning', color: 'purple' },
  { id: 'queued', title: '📅 Queued', color: 'zinc' },
  { id: 'ready', title: '🧩 Ready', color: 'blue' },
  { id: 'in_progress', title: '🔄 In Progress', color: 'amber' },
  { id: 'pending_review', title: '👁️ Review', color: 'orange' },
  { id: 'done', title: '✅ Done', color: 'green' },
  { id: 'failed', title: '❌ Failed', color: 'red' },
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

export function KanbanBoard() {
  const { moveMission } = useMissionControl();
  const missions = useFilteredMissions();
  const [activeMission, setActiveMission] = useState<Mission | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const mission = missions.find((m) => m.id === event.active.id);
    if (mission) setActiveMission(mission);
  }, [missions]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveMission(null);
    
    const { active, over } = event;
    if (!over) return;

    const missionId = active.id as string;
    const newColumnId = over.id as BoardColumnId;
    
    // Planning missions should be handled through the planning workflow panel.
    if (!BOARD_COLUMNS.some((col) => col.id === newColumnId) || newColumnId === 'planning') {
      return;
    }

    const mission = missions.find((entry) => entry.id === missionId);
    if (!mission) return;

    if (isPlanningMission(mission)) return;

    const currentColumn = getMissionColumnId(mission, Date.now());
    if (currentColumn === newColumnId) return;

    const newStatus = COLUMN_TO_STATUS[newColumnId];
    if (!newStatus) return;

    const currentStatus = mission.mission_status || mission.status;
    if (currentStatus !== newStatus) {
      moveMission(missionId, newStatus);
    }
  }, [missions, moveMission]);

  const getMissionsByColumn = (columnId: BoardColumnId) => {
    const nowMs = Date.now();
    const filtered = missions.filter((mission) => getMissionColumnId(mission, nowMs) === columnId);

    return filtered.sort((a, b) => {
      switch (columnId) {
        // Queued / Ready: next-to-trigger first (soonest scheduled at top)
        case 'queued':
        case 'ready': {
          const aTime = Date.parse(a.scheduled_at || '') || 0;
          const bTime = Date.parse(b.scheduled_at || '') || 0;
          return aTime - bTime;
        }
        // Active columns: most recently started at top
        case 'in_progress':
        case 'pending_review': {
          const aTime = Date.parse(a.started_at || a.updated_at || '') || 0;
          const bTime = Date.parse(b.started_at || b.updated_at || '') || 0;
          return bTime - aTime;
        }
        // Done: most recently completed at top
        case 'done': {
          const aTime = Date.parse(a.completed_at || a.updated_at || '') || 0;
          const bTime = Date.parse(b.completed_at || b.updated_at || '') || 0;
          return bTime - aTime;
        }
        // Failed: most recent failure at top
        case 'failed': {
          const aTime = Date.parse(a.updated_at || '') || 0;
          const bTime = Date.parse(b.updated_at || '') || 0;
          return bTime - aTime;
        }
        // Planning: newest plans at top
        case 'planning':
        default: {
          const aTime = Date.parse(a.created_at || '') || 0;
          const bTime = Date.parse(b.created_at || '') || 0;
          return bTime - aTime;
        }
      }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4 px-4">
        {BOARD_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            color={column.color}
            missions={getMissionsByColumn(column.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeMission && <MissionCard mission={activeMission} />}
      </DragOverlay>
    </DndContext>
  );
}
