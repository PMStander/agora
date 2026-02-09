import { useInvoicingStore, useFilteredQuotes } from '../../stores/invoicing';
import { useCrmStore } from '../../stores/crm';
import { QUOTE_STATUS_CONFIG } from '../../types/invoicing';
import type { QuoteStatus } from '../../types/invoicing';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };
  return map[color] || map.zinc;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface QuoteListProps {
  onCreateQuote: () => void;
}

export function QuoteList({ onCreateQuote }: QuoteListProps) {
  const quotes = useFilteredQuotes();
  const selectQuote = useInvoicingStore((s) => s.selectQuote);
  const selectedQuoteId = useInvoicingStore((s) => s.selectedQuoteId);
  const filters = useInvoicingStore((s) => s.filters);
  const setFilters = useInvoicingStore((s) => s.setFilters);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);

  const statusOptions: Array<{ value: QuoteStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All Statuses' },
    ...Object.entries(QUOTE_STATUS_CONFIG).map(([value, config]) => ({
      value: value as QuoteStatus,
      label: config.label,
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800">
        <select
          value={filters.quoteStatus}
          onChange={(e) => setFilters({ quoteStatus: e.target.value as QuoteStatus | 'all' })}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={onCreateQuote}
          className="px-4 py-1.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
        >
          + New Quote
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm">No quotes yet</p>
            <button
              onClick={onCreateQuote}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Create your first quote
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {quotes.map((quote) => {
              const contact = quote.contact_id
                ? contacts.find((c) => c.id === quote.contact_id)
                : null;
              const company = quote.company_id
                ? companies.find((c) => c.id === quote.company_id)
                : null;
              const statusConfig = QUOTE_STATUS_CONFIG[quote.status];

              return (
                <button
                  key={quote.id}
                  onClick={() => selectQuote(quote.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors ${
                    selectedQuoteId === quote.id ? 'bg-zinc-800/70' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {quote.quote_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] rounded-full ${statusBadgeClasses(statusConfig.color)}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    {quote.title && (
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {quote.title}
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {contact
                        ? `${contact.first_name} ${contact.last_name}`
                        : company
                        ? company.name
                        : 'No contact'}
                      {' -- '}
                      {relativeTime(quote.created_at)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-amber-400 shrink-0">
                    {formatCurrency(quote.total, quote.currency)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
