import { useState, Suspense, lazy } from 'react';
import { useCrmStore } from '../../../stores/crm';
import { useInvoicingStore } from '../../../stores/invoicing';
import { ProfileTabBar, type ProfileTab } from './ProfileTabBar';
import { ProfileEmptyState } from './ProfileEmptyState';
import { QUOTE_STATUS_CONFIG } from '../../../types/invoicing';

const LineItemsTab = lazy(() => import('./tabs/LineItemsTab'));
const DocumentsTab = lazy(() => import('./tabs/DocumentsTab'));

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400',
  sent: 'bg-blue-500/20 text-blue-400',
  viewed: 'bg-cyan-500/20 text-cyan-400',
  accepted: 'bg-emerald-500/20 text-emerald-400',
  declined: 'bg-red-500/20 text-red-400',
  expired: 'bg-orange-500/20 text-orange-400',
  converted: 'bg-purple-500/20 text-purple-400',
};

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

const TABS: ProfileTab[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'line_items', label: 'Line Items', icon: '📦' },
  { id: 'documents', label: 'Documents', icon: '📁' },
];

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function QuoteProfile({ quoteId }: { quoteId: string }) {
  const quote = useInvoicingStore((s) => s.quotes).find((q) => q.id === quoteId);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);
  const navigateToProfile = useCrmStore((s) => s.navigateToProfile);
  const [activeTab, setActiveTab] = useState('overview');

  if (!quote) {
    return <ProfileEmptyState message="Quote not found" />;
  }

  const statusConfig = QUOTE_STATUS_CONFIG[quote.status];
  const contact = quote.contact_id ? contacts.find((c) => c.id === quote.contact_id) : null;
  const company = quote.company_id ? companies.find((c) => c.id === quote.company_id) : null;
  const deal = quote.deal_id ? deals.find((d) => d.id === quote.deal_id) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">
              {quote.quote_number}
            </h1>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[quote.status] ?? STATUS_COLORS.draft}`}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400 mt-0.5">
            <span className="text-xl font-bold text-amber-400">
              {formatCurrency(quote.total, quote.currency)}
            </span>
            {quote.valid_until && (
              <>
                <span className="text-zinc-600">&middot;</span>
                <span>Valid until: {new Date(quote.valid_until).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <ProfileTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'overview' && (
          <OverviewContent
            quote={quote}
            contact={contact}
            company={company}
            deal={deal}
            navigateToProfile={navigateToProfile}
          />
        )}

        {activeTab === 'line_items' && (
          <Suspense fallback={<TabLoading />}>
            <LineItemsTab entityType="quote" entityId={quoteId} />
          </Suspense>
        )}

        {activeTab === 'documents' && (
          <Suspense fallback={<TabLoading />}>
            <DocumentsTab entityType="quote" entityId={quoteId} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab (Inline) ──────────────────────────────────────────────────

function OverviewContent({
  quote,
  contact,
  company,
  deal,
  navigateToProfile,
}: {
  quote: NonNullable<ReturnType<typeof useInvoicingStore.getState>['quotes'][number]>;
  contact: ReturnType<typeof useCrmStore.getState>['contacts'][number] | null | undefined;
  company: ReturnType<typeof useCrmStore.getState>['companies'][number] | null | undefined;
  deal: ReturnType<typeof useCrmStore.getState>['deals'][number] | null | undefined;
  navigateToProfile: ReturnType<typeof useCrmStore.getState>['navigateToProfile'];
}) {
  const statusConfig = QUOTE_STATUS_CONFIG[quote.status];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Quote Info */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Quote Info
        </h3>
        <div className="space-y-2.5">
          <InfoRow label="Number" value={quote.quote_number} />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Status</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[quote.status] ?? STATUS_COLORS.draft}`}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Total</span>
            <span className="text-amber-400 font-semibold">{formatCurrency(quote.total, quote.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Subtotal</span>
            <span className="text-zinc-300">{formatCurrency(quote.subtotal, quote.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Tax</span>
            <span className="text-zinc-300">{formatCurrency(quote.tax_total, quote.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Discount</span>
            <span className="text-zinc-300">{formatCurrency(quote.discount_total, quote.currency)}</span>
          </div>
          <InfoRow label="Valid Until" value={quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : null} />
          {quote.customer_note && (
            <div className="pt-2 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">Note</span>
              <p className="text-sm text-zinc-400 mt-1">{quote.customer_note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Related Entities */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Contact
        </h3>
        {contact ? (
          <button
            onClick={() => navigateToProfile('contact', contact.id, quote.quote_number)}
            className="w-full flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-left hover:border-zinc-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-semibold shrink-0">
              {contact.first_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 truncate">
                {contact.first_name} {contact.last_name}
              </div>
              <div className="text-xs text-zinc-500 truncate">
                {contact.job_title || contact.email || 'Contact'}
              </div>
            </div>
          </button>
        ) : (
          <p className="text-sm text-zinc-600">No contact linked</p>
        )}

        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 mt-5">
          Company
        </h3>
        {company ? (
          <button
            onClick={() => navigateToProfile('company', company.id, quote.quote_number)}
            className="w-full flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-left hover:border-zinc-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-semibold shrink-0">
              {company.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 truncate">{company.name}</div>
              <div className="text-xs text-zinc-500 truncate">
                {company.industry || company.domain || 'Company'}
              </div>
            </div>
          </button>
        ) : (
          <p className="text-sm text-zinc-600">No company linked</p>
        )}

        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 mt-5">
          Deal
        </h3>
        {deal ? (
          <button
            onClick={() => navigateToProfile('deal', deal.id, quote.quote_number)}
            className="w-full flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-left hover:border-zinc-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-semibold shrink-0">
              💰
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 truncate">{deal.title}</div>
              <div className="text-xs text-zinc-500 truncate">
                {formatCurrency(deal.amount, deal.currency)}
              </div>
            </div>
          </button>
        ) : (
          <p className="text-sm text-zinc-600">No deal linked</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500 w-24 shrink-0">{label}</span>
      <span className="text-zinc-300 truncate">{value || '--'}</span>
    </div>
  );
}
