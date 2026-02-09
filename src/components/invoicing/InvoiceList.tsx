import { useInvoicingStore, useFilteredInvoices } from '../../stores/invoicing';
import { useCrmStore } from '../../stores/crm';
import { INVOICE_STATUS_CONFIG } from '../../types/invoicing';
import type { InvoiceStatus } from '../../types/invoicing';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
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

interface InvoiceListProps {
  onCreateInvoice: () => void;
}

export function InvoiceList({ onCreateInvoice }: InvoiceListProps) {
  const invoices = useFilteredInvoices();
  const selectInvoice = useInvoicingStore((s) => s.selectInvoice);
  const selectedInvoiceId = useInvoicingStore((s) => s.selectedInvoiceId);
  const filters = useInvoicingStore((s) => s.filters);
  const setFilters = useInvoicingStore((s) => s.setFilters);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);

  const statusOptions: Array<{ value: InvoiceStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All Statuses' },
    ...Object.entries(INVOICE_STATUS_CONFIG).map(([value, config]) => ({
      value: value as InvoiceStatus,
      label: config.label,
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800">
        <select
          value={filters.invoiceStatus}
          onChange={(e) => setFilters({ invoiceStatus: e.target.value as InvoiceStatus | 'all' })}
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
          onClick={onCreateInvoice}
          className="px-4 py-1.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
        >
          + New Invoice
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2">
            <span className="text-3xl">📄</span>
            <p className="text-sm">No invoices yet</p>
            <button
              onClick={onCreateInvoice}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Create your first invoice
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {invoices.map((invoice) => {
              const contact = invoice.contact_id
                ? contacts.find((c) => c.id === invoice.contact_id)
                : null;
              const company = invoice.company_id
                ? companies.find((c) => c.id === invoice.company_id)
                : null;
              const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];

              return (
                <button
                  key={invoice.id}
                  onClick={() => selectInvoice(invoice.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors ${
                    selectedInvoiceId === invoice.id ? 'bg-zinc-800/70' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {invoice.invoice_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] rounded-full ${statusBadgeClasses(statusConfig.color)}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {contact
                        ? `${contact.first_name} ${contact.last_name}`
                        : company
                        ? company.name
                        : 'No contact'}
                      {invoice.due_date && (
                        <>
                          {' -- Due: '}
                          {new Date(invoice.due_date).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-amber-400">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </div>
                    {invoice.amount_due > 0 && invoice.amount_due < invoice.total && (
                      <div className="text-[10px] text-red-400">
                        Due: {formatCurrency(invoice.amount_due, invoice.currency)}
                      </div>
                    )}
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
