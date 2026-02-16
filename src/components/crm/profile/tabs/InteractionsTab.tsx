import { useInteractionsForEntity } from '../../../../stores/crm';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { TabHeader } from './TabHeader';
import { INTERACTION_TYPE_CONFIG } from '../../../../types/crm';
import type { InteractionType } from '../../../../types/crm';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface InteractionsTabProps {
  entityType: string;
  entityId: string;
  onLogInteraction?: () => void;
}

export default function InteractionsTab({ entityType, entityId, onLogInteraction }: InteractionsTabProps) {
  const interactions = useInteractionsForEntity(
    entityType as 'contact' | 'company' | 'deal',
    entityId,
  );

  if (!interactions.length) return <ProfileEmptyState message="No interactions yet" actionLabel="Log Interaction" onAction={onLogInteraction} />;

  return (
    <div>
      <TabHeader count={interactions.length} noun="interaction" actionLabel="Log Interaction" onAction={onLogInteraction} />
      <div className="space-y-2">
        {interactions.map(interaction => {
          const typeCfg = INTERACTION_TYPE_CONFIG[interaction.interaction_type as InteractionType];
          return (
            <div
              key={interaction.id}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base leading-none">{typeCfg?.emoji ?? '📌'}</span>
                <span className="text-sm font-medium text-zinc-200 truncate">
                  {interaction.subject || typeCfg?.label || 'Interaction'}
                </span>
                {interaction.direction && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-zinc-700/50 text-zinc-400">
                    {interaction.direction}
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-500">{relativeTime(interaction.created_at)}</span>
              </div>
              {interaction.body && (
                <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{interaction.body}</p>
              )}
              {interaction.duration_minutes != null && interaction.duration_minutes > 0 && (
                <span className="text-xs text-zinc-600 mt-1 inline-block">{interaction.duration_minutes}min</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
