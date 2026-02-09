import type { ProjectContext } from '../../types/context';

interface ProjectContextCardProps {
  context: ProjectContext;
  onSelect: (id: string) => void;
  isActive: boolean;
}

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

export function ProjectContextCard({
  context,
  onSelect,
  isActive,
}: ProjectContextCardProps) {
  return (
    <button
      onClick={() => onSelect(context.id)}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        isActive
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm text-zinc-200 truncate">
          {context.title}
        </h3>
        <span className="text-xs text-zinc-500 shrink-0">
          {formatRelativeTime(context.last_updated_at || context.created_at)}
        </span>
      </div>
      <p className="text-xs text-zinc-500 mt-1 truncate">
        Project: {context.project_id}
      </p>
      {context.last_updated_by_agent_id && (
        <p className="text-xs text-zinc-600 mt-1">
          Last updated by {context.last_updated_by_agent_id}
        </p>
      )}
    </button>
  );
}
