import { useAgentStore } from '../../stores/agents';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUS_CONFIG,
  SOURCE_LABELS,
  type DocumentCenterItem,
} from '../../types/documentCenter';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400',
  active: 'bg-green-500/20 text-green-400',
  awaiting_approval: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  archived: 'bg-zinc-500/20 text-zinc-500',
  closed: 'bg-blue-500/20 text-blue-400',
};

interface Props {
  item: DocumentCenterItem;
  isSelected: boolean;
  onClick: () => void;
}

export function DocumentCenterListItem({ item, isSelected, onClick }: Props) {
  const allAgents = useAgentStore((s) => s.teams).flatMap((t) => t.agents);
  const catConfig = DOCUMENT_CATEGORIES.find((c) => c.id === item.category);
  const statusConfig = DOCUMENT_STATUS_CONFIG[item.status];
  const statusColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.active;

  const contribEmojis = item.contributors
    .slice(0, 3)
    .map((c) => {
      const agent = allAgents.find((a) => a.id === c.agentId);
      return agent?.emoji ?? '?';
    });

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-4 py-3 border-b border-zinc-800/50 transition-colors
        ${isSelected ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'hover:bg-zinc-800/50'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <span className="text-lg mt-0.5 shrink-0">{catConfig?.icon ?? '📄'}</span>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-100 truncate">{item.title}</span>
            {item.requiresApproval && (
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/20 text-amber-400">
                Needs Approval
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-500 truncate mt-0.5">{item.contentPreview || SOURCE_LABELS[item.source]}</p>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusColor}`}>
            {statusConfig?.label ?? item.status}
          </span>

          {/* Contributor emojis */}
          {contribEmojis.length > 0 && (
            <div className="flex -space-x-1">
              {contribEmojis.map((emoji, i) => (
                <span key={i} className="text-xs" title={item.contributors[i]?.agentId}>
                  {emoji}
                </span>
              ))}
            </div>
          )}

          <span className="text-[10px] text-zinc-600">{timeAgo(item.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}
