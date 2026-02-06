import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '../../types/supabase';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
}

const columnColors: Record<string, string> = {
  gray: 'border-zinc-600',
  blue: 'border-blue-500',
  yellow: 'border-amber-500',
  purple: 'border-purple-500',
  green: 'border-emerald-500',
};

const headerColors: Record<string, string> = {
  gray: 'text-zinc-400',
  blue: 'text-blue-400',
  yellow: 'text-amber-400',
  purple: 'text-purple-400',
  green: 'text-emerald-400',
};

export function KanbanColumn({ id, title, color, tasks }: KanbanColumnProps) {
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
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center text-zinc-600 text-sm py-8">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
