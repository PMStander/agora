import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Agent } from '../../types/supabase';
import { useMissionControlStore } from '../../stores/missionControl';

interface TaskCardProps {
  task: Task;
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500',
};

const priorityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
  urgent: '🔥',
};

export function TaskCard({ task }: TaskCardProps) {
  const selectTask = useMissionControlStore((s) => s.selectTask);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => selectTask(task.id)}
      className={`
        bg-zinc-800 border border-zinc-700 rounded-lg p-3 cursor-pointer
        hover:border-amber-500/50 hover:bg-zinc-750 transition-colors
        ${isDragging ? 'shadow-lg shadow-amber-500/20' : ''}
      `}
    >
      {/* Priority indicator */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
        <span className="text-xs text-zinc-500">{priorityLabels[task.priority]}</span>
        {task.domains && task.domains.length > 0 && (
          <span className="text-xs text-zinc-600 ml-auto">
            {task.domains[0]}
            {task.domains.length > 1 && ` +${task.domains.length - 1}`}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-zinc-100 line-clamp-2 mb-2">
        {task.title}
      </h3>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Assignees */}
        <div className="flex -space-x-2">
          {task.assignees?.slice(0, 3).map((agent: Agent) => (
            <div
              key={agent.id}
              className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-800 flex items-center justify-center"
              title={agent.name}
            >
              {agent.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs text-zinc-400">
                  {agent.name.charAt(0)}
                </span>
              )}
            </div>
          ))}
          {task.assignees && task.assignees.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-zinc-600 border-2 border-zinc-800 flex items-center justify-center">
              <span className="text-xs text-zinc-300">
                +{task.assignees.length - 3}
              </span>
            </div>
          )}
        </div>

        {/* Comment count */}
        {task.comment_count && task.comment_count > 0 && (
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            💬 {task.comment_count}
          </span>
        )}
      </div>
    </div>
  );
}
