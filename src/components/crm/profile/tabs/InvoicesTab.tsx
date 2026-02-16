import { useCrmStore } from '../../../../stores/crm';
import { useInvoicesForDeal, useInvoicesForContact, useInvoicesForCompany } from '../../../../stores/invoicing';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { TabHeader } from './TabHeader';
import { INVOICE_STATUS_CONFIG } from '../../../../types/invoicing';

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

export default function InvoicesTab({ entityType, entityId }: { entityType: string; entityId: string }) {
  const navigateToProfile = useCrmStore(s => s.navigateToProfile);

  const dealInvoices = useInvoicesForDeal(entityType === 'deal' ? entityId : null);
  const contactInvoices = useInvoicesForContact(entityType === 'contact' ? entityId : null);
  const companyInvoices = useInvoicesForCompany(entityType === 'company' ? entityId : null);

  const invoices =
    entityType === 'deal' ? dealInvoices :
    entityType === 'contact' ? contactInvoices :
    companyInvoices;

  if (!invoices.length) return <ProfileEmptyState message="No invoices yet — create one from a quote" />;

  return (
    <div>
      <TabHeader count={invoices.length} noun="invoice" />
      <div className="space-y-2">
        {invoices.map(invoice => {
          const statusCfg = INVOICE_STATUS_CONFIG[invoice.status];
          const colorClass = STATUS_COLORS[statusCfg?.color] ?? STATUS_COLORS.zinc;
          const isPaid = invoice.status === 'paid';
          return (
            <div
              key={invoice.id}
              onClick={() => navigateToProfile('invoice', invoice.id, invoice.invoice_number)}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{invoice.invoice_number}</span>
                  {isPaid && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">Paid</span>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 text-xs rounded ${colorClass}`}>
                  {statusCfg?.label ?? invoice.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                {invoice.due_date && (
                  <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
                )}
                <span className="ml-auto">{relativeTime(invoice.issue_date)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
