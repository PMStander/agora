import { useState, Suspense, lazy } from 'react';
import { useCrmStore } from '../../../stores/crm';
import { useInvoicingStore } from '../../../stores/invoicing';
import { ProfileTabBar, type ProfileTab } from './ProfileTabBar';
import { ProfileEmptyState } from './ProfileEmptyState';
import { INVOICE_STATUS_CONFIG } from '../../../types/invoicing';

const LineItemsTab = lazy(() => import('./tabs/LineItemsTab'));
const PaymentsTab = lazy(() => import('./tabs/PaymentsTab'));
const DocumentsTab = lazy(() => import('./tabs/DocumentsTab'));

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400',
  sent: 'bg-blue-500/20 text-blue-400',
  viewed: 'bg-cyan-500/20 text-cyan-400',
  partially_paid: 'bg-amber-500/20 text-amber-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  overdue: 'bg-red-500/20 text-red-400',
  void: 'bg-zinc-500/20 text-zinc-400',
  refunded: 'bg-purple-500/20 text-purple-400',
  cancelled: 'bg-zinc-500/20 text-zinc-400',
};

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

const TABS: ProfileTab[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'line_items', label: 'Line Items', icon: '📦' },
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'documents', label: 'Documents', icon: '📁' },
];

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function InvoiceProfile({ invoiceId }: { invoiceId: string }) {
  const invoice = useInvoicingStore((s) => s.invoices).find((i) => i.id === invoiceId);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);
  const navigateToProfile = useCrmStore((s) => s.navigateToProfile);
  const [activeTab, setActiveTab] = useState('overview');

  if (!invoice) {
    return <ProfileEmptyState message="Invoice not found" />;
  }

  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];
  const contact = invoice.contact_id ? contacts.find((c) => c.id === invoice.contact_id) : null;
  const company = invoice.company_id ? companies.find((c) => c.id === invoice.company_id) : null;
  const deal = invoice.deal_id ? deals.find((d) => d.id === invoice.deal_id) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">
              {invoice.invoice_number}
            </h1>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[invoice.status] ?? STATUS_COLORS.draft}`}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400 mt-0.5">
            <span className="text-xl font-bold text-amber-400">
              {formatCurrency(invoice.total, invoice.currency)}
            </span>
            {invoice.due_date && (
              <>
                <span className="text-zinc-600">&middot;</span>
                <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
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
            invoice={invoice}
            contact={contact}
            company={company}
            deal={deal}
            navigateToProfile={navigateToProfile}
          />
        )}

        {activeTab === 'line_items' && (
          <Suspense fallback={<TabLoading />}>
            <LineItemsTab entityType="invoice" entityId={invoiceId} />
          </Suspense>
        )}

        {activeTab === 'payments' && (
          <Suspense fallback={<TabLoading />}>
            <PaymentsTab invoiceId={invoiceId} />
          </Suspense>
        )}

        {activeTab === 'documents' && (
          <Suspense fallback={<TabLoading />}>
            <DocumentsTab entityType="invoice" entityId={invoiceId} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab (Inline) ──────────────────────────────────────────────────

function OverviewContent({
  invoice,
  contact,
  company,
  deal,
  navigateToProfile,
}: {
  invoice: NonNullable<ReturnType<typeof useInvoicingStore.getState>['invoices'][number]>;
  contact: ReturnType<typeof useCrmStore.getState>['contacts'][number] | null | undefined;
  company: ReturnType<typeof useCrmStore.getState>['companies'][number] | null | undefined;
  deal: ReturnType<typeof useCrmStore.getState>['deals'][number] | null | undefined;
  navigateToProfile: ReturnType<typeof useCrmStore.getState>['navigateToProfile'];
}) {
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Invoice Info */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Invoice Info
        </h3>
        <div className="space-y-2.5">
          <InfoRow label="Number" value={invoice.invoice_number} />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Status</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[invoice.status] ?? STATUS_COLORS.draft}`}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Total</span>
            <span className="text-amber-400 font-semibold">{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Subtotal</span>
            <span className="text-zinc-300">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Tax</span>
            <span className="text-zinc-300">{formatCurrency(invoice.tax_total, invoice.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Discount</span>
            <span className="text-zinc-300">{formatCurrency(invoice.discount_total, invoice.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Paid</span>
            <span className="text-emerald-400 font-medium">{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Due</span>
            <span className={`font-medium ${invoice.amount_due > 0 ? 'text-red-400' : 'text-zinc-300'}`}>
              {formatCurrency(invoice.amount_due, invoice.currency)}
            </span>
          </div>
          <InfoRow label="Due Date" value={invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : null} />
          <InfoRow label="Issue Date" value={invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : null} />
          {invoice.customer_note && (
            <div className="pt-2 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">Note</span>
              <p className="text-sm text-zinc-400 mt-1">{invoice.customer_note}</p>
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
            onClick={() => navigateToProfile('contact', contact.id, invoice.invoice_number)}
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
            onClick={() => navigateToProfile('company', company.id, invoice.invoice_number)}
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
            onClick={() => navigateToProfile('deal', deal.id, invoice.invoice_number)}
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
