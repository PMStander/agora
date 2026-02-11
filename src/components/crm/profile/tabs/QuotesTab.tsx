import { useCrmStore } from '../../../../stores/crm';
import { useQuotesForDeal, useQuotesForContact, useQuotesForCompany } from '../../../../stores/invoicing';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { QUOTE_STATUS_CONFIG } from '../../../../types/invoicing';

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

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

const STATUS_COLORS: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-400',
  blue: 'bg-blue-500/20 text-blue-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  amber: 'bg-amber-500/20 text-amber-400',
  purple: 'bg-purple-500/20 text-purple-400',
};

export default function QuotesTab({ entityType, entityId }: { entityType: string; entityId: string }) {
  const navigateToProfile = useCrmStore(s => s.navigateToProfile);

  const dealQuotes = useQuotesForDeal(entityType === 'deal' ? entityId : null);
  const contactQuotes = useQuotesForContact(entityType === 'contact' ? entityId : null);
  const companyQuotes = useQuotesForCompany(entityType === 'company' ? entityId : null);

  const quotes =
    entityType === 'deal' ? dealQuotes :
    entityType === 'contact' ? contactQuotes :
    companyQuotes;

  if (!quotes.length) return <ProfileEmptyState message="No quotes yet" />;

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</p>
      <div className="space-y-2">
        {quotes.map(quote => {
          const statusCfg = QUOTE_STATUS_CONFIG[quote.status];
          const colorClass = STATUS_COLORS[statusCfg?.color] ?? STATUS_COLORS.zinc;
          return (
            <div
              key={quote.id}
              onClick={() => navigateToProfile('quote', quote.id, quote.quote_number)}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-200">{quote.quote_number}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded ${colorClass}`}>
                  {statusCfg?.label ?? quote.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{formatCurrency(quote.total, quote.currency)}</span>
                {quote.valid_until && (
                  <span>Valid until: {new Date(quote.valid_until).toLocaleDateString()}</span>
                )}
                <span className="ml-auto">{relativeTime(quote.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
