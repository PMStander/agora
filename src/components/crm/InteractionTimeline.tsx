import { useCrmStore } from '../../stores/crm';
import { INTERACTION_TYPE_CONFIG } from '../../types/crm';
import { getAgent } from '../../types/supabase';
import type { CrmInteraction } from '../../types/crm';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface InteractionItemProps {
  interaction: CrmInteraction;
}

function InteractionItem({ interaction }: InteractionItemProps) {
  const contacts = useCrmStore((s) => s.contacts);
  const typeConfig = INTERACTION_TYPE_CONFIG[interaction.interaction_type] ??
    INTERACTION_TYPE_CONFIG.other;
  const agent = interaction.agent_id ? getAgent(interaction.agent_id) : null;
  const contact = interaction.contact_id
    ? contacts.find((c) => c.id === interaction.contact_id)
    : null;

  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-zinc-800/50 rounded-lg transition-colors">
      <span className="text-lg flex-shrink-0">{typeConfig.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 truncate">
          {interaction.subject ?? typeConfig.label}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {contact && (
            <span className="text-xs text-zinc-400">
              {contact.first_name} {contact.last_name}
            </span>
          )}
          {agent && (
            <span className="text-xs text-zinc-500" title={agent.role}>
              {agent.emoji} {agent.name}
            </span>
          )}
          {interaction.direction && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                interaction.direction === 'inbound'
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {interaction.direction === 'inbound' ? 'Inbound' : 'Outbound'}
            </span>
          )}
          <span className="text-xs text-zinc-600">
            {formatRelativeTime(interaction.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function InteractionTimeline() {
  const interactions = useCrmStore((s) => s.interactions);

  // Sort by created_at descending (most recent first)
  const sorted = [...interactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600">
        <div className="text-center">
          <p className="text-sm">No interactions yet</p>
          <p className="text-xs mt-1">Log a call, email, or meeting to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Interactions</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {sorted.length}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {sorted.map((interaction) => (
            <InteractionItem key={interaction.id} interaction={interaction} />
          ))}
        </div>
      </div>
    </div>
  );
}
