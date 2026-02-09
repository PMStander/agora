import { useCrmStore } from '../../stores/crm';
import { getAgent } from '../../types/supabase';
import type { Deal } from '../../types/crm';

interface DealCardProps {
  deal: Deal;
  isDragOverlay?: boolean;
}

const priorityDot: Record<string, string> = {
  low: 'bg-zinc-400',
  medium: 'bg-blue-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500 animate-pulse',
};

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DealCard({ deal, isDragOverlay }: DealCardProps) {
  const selectDeal = useCrmStore((s) => s.selectDeal);
  const contacts = useCrmStore((s) => s.contacts);
  const agent = deal.owner_agent_id ? getAgent(deal.owner_agent_id) : null;
  const contact = deal.contact_id
    ? contacts.find((c) => c.id === deal.contact_id)
    : null;

  return (
    <div
      onClick={() => selectDeal(deal.id)}
      className={`
        bg-zinc-800 border border-zinc-700 rounded-lg p-3 cursor-grab
        hover:border-zinc-600 transition-colors
        ${isDragOverlay ? 'shadow-lg shadow-amber-500/20' : ''}
      `}
    >
      {/* Priority + Amount */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[deal.priority] ?? priorityDot.medium}`} />
        <span className="text-xs text-zinc-500 capitalize">{deal.priority}</span>
        <span className="text-xs text-zinc-300 font-medium ml-auto">
          {formatCurrency(deal.amount, deal.currency)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-zinc-100 line-clamp-2 mb-2">
        {deal.title}
      </h3>

      {/* Footer: contact + agent */}
      <div className="flex items-center justify-between">
        {/* Contact */}
        {contact ? (
          <span className="text-xs text-zinc-400 truncate max-w-[120px]">
            {contact.first_name} {contact.last_name}
          </span>
        ) : (
          <span className="text-xs text-zinc-600">No contact</span>
        )}

        {/* Agent */}
        {agent && (
          <div className="flex items-center gap-1" title={`${agent.name} — ${agent.role}`}>
            <span className="text-sm">{agent.emoji}</span>
            <span className="text-xs text-zinc-400 truncate max-w-[80px]">
              {agent.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
