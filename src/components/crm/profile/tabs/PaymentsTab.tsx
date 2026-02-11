import { useInvoicingStore } from '../../../../stores/invoicing';
import { ProfileEmptyState } from '../ProfileEmptyState';

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

export default function PaymentsTab({ invoiceId }: { invoiceId: string }) {
  const invoice = useInvoicingStore(s => s.invoices).find(i => i.id === invoiceId);

  if (!invoice) return <ProfileEmptyState message="Invoice not found" />;

  const payments = invoice.payments;

  if (!payments || !payments.length) {
    return <ProfileEmptyState message="No payments recorded yet" />;
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">
        {payments.length} payment{payments.length !== 1 ? 's' : ''} &middot; {formatCurrency(totalPaid, invoice.currency)} paid
      </p>
      <div className="space-y-2">
        {payments.map(payment => (
          <div
            key={payment.id}
            className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-zinc-200">
                {formatCurrency(payment.amount, invoice.currency)}
              </span>
              {payment.payment_method && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-zinc-700/50 text-zinc-400">
                  {payment.payment_method}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              {payment.reference_number && <span>Ref: {payment.reference_number}</span>}
              <span className="ml-auto">{relativeTime(payment.paid_at)}</span>
            </div>
            {payment.notes && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{payment.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
