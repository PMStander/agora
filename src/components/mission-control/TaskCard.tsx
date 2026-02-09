import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types/supabase';
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

function formatDueDate(iso: string): string {
  const due = new Date(iso);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const mins = Math.round(diffMs / 60000);
  if (Math.abs(mins) < 60) {
    if (mins >= 0) return `in ${mins}m`;
    return `${Math.abs(mins)}m late`;
  }
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) {
    if (hours >= 0) return `in ${hours}h`;
    return `${Math.abs(hours)}h late`;
  }
  return due.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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
        {task.review_enabled && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">Review</span>
        )}
        {task.active_phase && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300" title={task.active_summary ?? undefined}>
            {task.active_phase === 'primary' ? 'Running' : 'Reviewing'}
          </span>
        )}
        {!task.active_phase && (task.status === 'todo' || task.status === 'blocked') && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300" title={task.active_summary ?? undefined}>
            Waiting
          </span>
        )}
        {task.status === 'blocked' && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">Blocked</span>
        )}
        {task.title.endsWith('(Redo)') && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">Redo</span>
        )}
        {task.revision_round > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
            R{task.revision_round}
          </span>
        )}
        {task.review_history && task.review_history.length > 0 && (
          <span
            className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300"
            title={task.review_history.map((entry) => `${entry.action}: ${entry.summary}`).join('\n')}
          >
            {task.review_history.length} review{task.review_history.length !== 1 ? 's' : ''}
          </span>
        )}
        {task.dependency_task_ids.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
            deps {task.dependency_task_ids.length}
          </span>
        )}
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
        <div className="text-xs text-zinc-500">{formatDueDate(task.due_at)}</div>
        {/* Assignees */}
        <div className="flex -space-x-2">
          {task.assignees?.slice(0, 3).map((assignee) => (
            <div
              key={assignee.id}
              className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-800 flex items-center justify-center"
              title={assignee.name}
            >
              <span className="text-xs">{assignee.emoji}</span>
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
      </div>

      {task.active_summary && (
        <div className="mt-2 text-xs text-zinc-400 truncate">
          {task.active_summary}
        </div>
      )}

      {/* Live Thinking Preview - Shows last 150 chars of agent reasoning */}
      {task.active_thinking && task.active_phase && (
        <div className="mt-2 pt-2 border-t border-zinc-700/50">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-amber-400/80 font-medium">
              {task.active_phase === 'primary' ? 'Thinking' : 'Reviewing'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 line-clamp-3 font-mono leading-relaxed">
            {task.active_thinking.slice(-150)}
          </div>
        </div>
      )}
    </div>
  );
}
