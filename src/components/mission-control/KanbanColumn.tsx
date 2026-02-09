import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Mission } from '../../types/supabase';
import { MissionCard } from './MissionCard';

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  missions: Mission[];
}

const columnColors: Record<string, string> = {
  zinc: 'border-zinc-600',
  blue: 'border-blue-500',
  amber: 'border-amber-500',
  purple: 'border-purple-500',
  orange: 'border-orange-500',
  green: 'border-emerald-500',
  red: 'border-red-500',
};

const headerColors: Record<string, string> = {
  zinc: 'text-zinc-400',
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  green: 'text-emerald-400',
  red: 'text-red-400',
};

export function KanbanColumn({ id, title, color, missions }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col min-w-[280px] max-w-[280px] h-full
        bg-zinc-900/50 rounded-lg border-t-2
        ${columnColors[color]}
        ${isOver ? 'bg-zinc-800/50' : ''}
        transition-colors
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <h3 className={`text-sm font-semibold ${headerColors[color]}`}>
          {title}
        </h3>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
          {missions.length}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext
          items={missions.map((mission) => mission.id)}
          strategy={verticalListSortingStrategy}
        >
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </SortableContext>

        {missions.length === 0 && (
          <div className="text-center text-zinc-600 text-sm py-8">
            No missions
          </div>
        )}
      </div>
    </div>
  );
}
