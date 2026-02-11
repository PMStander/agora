import { useInvoicingStore } from '../../../../stores/invoicing';
import { ProfileEmptyState } from '../ProfileEmptyState';

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

export default function LineItemsTab({ entityType, entityId }: { entityType: string; entityId: string }) {
  const quotes = useInvoicingStore(s => s.quotes);
  const invoices = useInvoicingStore(s => s.invoices);

  const entity =
    entityType === 'quote'
      ? quotes.find(q => q.id === entityId)
      : invoices.find(i => i.id === entityId);

  if (!entity) return <ProfileEmptyState message="Entity not found" />;

  const lineItems = entity.line_items ?? [];
  const currency = entity.currency;

  if (!lineItems.length) return <ProfileEmptyState message="No line items" />;

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500 border-b border-zinc-800">
              <th className="text-left py-2 pr-3 font-medium">Description</th>
              <th className="text-right py-2 px-3 font-medium">Qty</th>
              <th className="text-right py-2 px-3 font-medium">Unit Price</th>
              <th className="text-right py-2 pl-3 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map(item => (
              <tr key={item.id} className="border-b border-zinc-800/50">
                <td className="py-2 pr-3 text-zinc-300">
                  <div className="truncate max-w-[200px]">{item.name}</div>
                  {item.description && (
                    <div className="text-xs text-zinc-500 truncate max-w-[200px]">{item.description}</div>
                  )}
                </td>
                <td className="py-2 px-3 text-right text-zinc-400">{item.quantity}</td>
                <td className="py-2 px-3 text-right text-zinc-400">{formatCurrency(item.unit_price, currency)}</td>
                <td className="py-2 pl-3 text-right text-zinc-300">{formatCurrency(item.subtotal, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1 text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span>{formatCurrency(entity.subtotal, currency)}</span>
        </div>
        {entity.tax_total > 0 && (
          <div className="flex justify-between text-zinc-400">
            <span>Tax</span>
            <span>{formatCurrency(entity.tax_total, currency)}</span>
          </div>
        )}
        {entity.discount_total > 0 && (
          <div className="flex justify-between text-zinc-400">
            <span>Discount</span>
            <span>-{formatCurrency(entity.discount_total, currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-zinc-200 font-medium pt-1 border-t border-zinc-800">
          <span>Total</span>
          <span>{formatCurrency(entity.total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
