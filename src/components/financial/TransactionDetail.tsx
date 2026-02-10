import { useSelectedTransaction, useFinancialStore } from '../../stores/financial';
import {
  TRANSACTION_TYPE_CONFIG,
  TRANSACTION_STATUS_CONFIG,
} from '../../types/financial';

export function TransactionDetail() {
  const transaction = useSelectedTransaction();
  const categories = useFinancialStore((s) => s.categories);
  const bankAccounts = useFinancialStore((s) => s.bankAccounts);
  const taxRates = useFinancialStore((s) => s.taxRates);
  const selectTransaction = useFinancialStore((s) => s.selectTransaction);

  if (!transaction) return null;

  const typeConfig = TRANSACTION_TYPE_CONFIG[transaction.transaction_type];
  const statusConfig = TRANSACTION_STATUS_CONFIG[transaction.status];
  const category = categories.find((c) => c.id === transaction.category_id);
  const bankAccount = bankAccounts.find((a) => a.id === transaction.bank_account_id);
  const taxRate = taxRates.find((r) => r.id === transaction.tax_rate_id);

  const fmt = (n: number) =>
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-200">Transaction Detail</h3>
        <button
          onClick={() => selectTransaction(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Amount + Type */}
        <div className="text-center py-3">
          <span
            className={`text-3xl font-mono font-bold ${
              transaction.transaction_type === 'income' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {transaction.transaction_type === 'income' ? '+' : '-'}${fmt(transaction.amount)}
          </span>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                typeConfig.color === 'green'
                  ? 'bg-green-500/20 text-green-400'
                  : typeConfig.color === 'red'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {typeConfig.icon} {typeConfig.label}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                statusConfig.color === 'green'
                  ? 'bg-green-500/20 text-green-400'
                  : statusConfig.color === 'amber'
                  ? 'bg-amber-500/20 text-amber-400'
                  : statusConfig.color === 'blue'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
          {transaction.description && (
            <DetailRow label="Description" value={transaction.description} />
          )}

          <DetailRow
            label="Date"
            value={new Date(transaction.transaction_date).toLocaleDateString('en', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />

          <DetailRow label="Currency" value={transaction.currency} />

          {category && (
            <DetailRow
              label="Category"
              value={category.name}
              color={category.color || undefined}
            />
          )}

          {bankAccount && (
            <DetailRow label="Account" value={bankAccount.name} />
          )}

          {transaction.payee_name && (
            <DetailRow label="Payee" value={transaction.payee_name} />
          )}

          {transaction.reference_number && (
            <DetailRow label="Reference" value={transaction.reference_number} />
          )}

          {/* Tax info */}
          {transaction.tax_amount > 0 && (
            <DetailRow
              label="Tax"
              value={`$${fmt(transaction.tax_amount)}${taxRate ? ` (${taxRate.name})` : ''}${
                transaction.is_tax_inclusive ? ' inclusive' : ''
              }`}
            />
          )}

          {/* Source links */}
          {transaction.invoice_id && (
            <DetailRow label="Invoice" value={`Linked to invoice`} />
          )}
          {transaction.deal_id && (
            <DetailRow label="Deal" value={`Linked to deal`} />
          )}

          {/* Tags */}
          {transaction.tags && transaction.tags.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {transaction.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {transaction.notes && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Notes</p>
              <p className="text-xs text-zinc-300 bg-zinc-800/50 rounded p-2">
                {transaction.notes}
              </p>
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="pt-3 border-t border-zinc-800 space-y-1">
          <p className="text-xs text-zinc-600">
            Created {new Date(transaction.created_at).toLocaleString()}
          </p>
          <p className="text-xs text-zinc-600">
            Updated {new Date(transaction.updated_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-zinc-200" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}
