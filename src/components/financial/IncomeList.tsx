import { useIncomeTransactions, useFinancialStore } from '../../stores/financial';
import { TRANSACTION_STATUS_CONFIG } from '../../types/financial';

export function IncomeList() {
  const incomeTransactions = useIncomeTransactions();
  const selectTransaction = useFinancialStore((s) => s.selectTransaction);
  const selectedId = useFinancialStore((s) => s.selectedTransactionId);

  const fmt = (n: number) =>
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalIncome = incomeTransactions
    .filter((t) => t.status === 'completed' || t.status === 'reconciled')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="h-full overflow-y-auto">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">Income</h3>
          <span className="text-xs text-zinc-500">
            {incomeTransactions.length} transaction{incomeTransactions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-sm font-mono text-green-400">
          +${fmt(totalIncome)}
        </span>
      </div>

      {/* List */}
      {incomeTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-sm">No income recorded yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Income is auto-synced when invoice payments are recorded
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {incomeTransactions.map((t) => {
            const statusConfig = TRANSACTION_STATUS_CONFIG[t.status];
            const isSelected = t.id === selectedId;

            return (
              <div
                key={t.id}
                onClick={() => selectTransaction(isSelected ? null : t.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-amber-500/10 border-l-2 border-amber-500'
                    : 'hover:bg-zinc-800/50 border-l-2 border-transparent'
                }`}
              >
                <span className="w-7 h-7 flex items-center justify-center rounded bg-green-500/20 text-green-400 text-sm">
                  ↓
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-200 truncate">
                      {t.description || t.payee_name || 'Income'}
                    </p>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
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
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">
                      {new Date(t.transaction_date).toLocaleDateString()}
                    </span>
                    {t.reference_number && (
                      <span className="text-xs text-zinc-600">
                        Ref: {t.reference_number}
                      </span>
                    )}
                    {t.invoice_id && (
                      <span className="text-xs text-blue-400/60">
                        From invoice
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-mono text-green-400 shrink-0">
                  +${fmt(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
