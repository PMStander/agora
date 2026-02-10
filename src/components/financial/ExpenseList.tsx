import { useState } from 'react';
import { useExpenseTransactions, useFinancialStore, useActiveCategories } from '../../stores/financial';
import { TRANSACTION_STATUS_CONFIG } from '../../types/financial';
import { CreateExpenseModal } from './CreateExpenseModal';

export function ExpenseList() {
  const expenseTransactions = useExpenseTransactions();
  const categories = useActiveCategories('expense');
  const selectTransaction = useFinancialStore((s) => s.selectTransaction);
  const selectedId = useFinancialStore((s) => s.selectedTransactionId);
  const filters = useFinancialStore((s) => s.filters);
  const setFilters = useFinancialStore((s) => s.setFilters);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalExpenses = expenseTransactions
    .filter((t) => t.status === 'completed' || t.status === 'reconciled')
    .reduce((sum, t) => sum + t.amount, 0);

  // Build a category lookup
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <div className="h-full overflow-y-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">Expenses</h3>
          <span className="text-xs text-zinc-500">
            {expenseTransactions.length} transaction{expenseTransactions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-red-400">
            -${fmt(totalExpenses)}
          </span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-xs bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800/50 overflow-x-auto">
        <button
          onClick={() => setFilters({ categoryId: null })}
          className={`shrink-0 px-2.5 py-1 text-xs rounded-lg transition-colors ${
            !filters.categoryId
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilters({ categoryId: cat.id })}
            className={`shrink-0 px-2.5 py-1 text-xs rounded-lg transition-colors ${
              filters.categoryId === cat.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* List */}
      {expenseTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-sm">No expenses recorded yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Click "Add Expense" to track your business spending
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {expenseTransactions.map((t) => {
            const statusConfig = TRANSACTION_STATUS_CONFIG[t.status];
            const category = t.category_id ? categoryMap[t.category_id] : null;
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
                <span className="w-7 h-7 flex items-center justify-center rounded bg-red-500/20 text-red-400 text-sm">
                  ↑
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-200 truncate">
                      {t.description || t.payee_name || 'Expense'}
                    </p>
                    {category && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded border border-zinc-700"
                        style={{ color: category.color || undefined }}
                      >
                        {category.name}
                      </span>
                    )}
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
                    {t.payee_name && (
                      <span className="text-xs text-zinc-600">
                        To: {t.payee_name}
                      </span>
                    )}
                    {t.tags && t.tags.length > 0 && (
                      <div className="flex gap-1">
                        {t.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs text-zinc-600">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-sm font-mono text-red-400 shrink-0">
                  -${fmt(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Expense Modal */}
      {showCreateModal && (
        <CreateExpenseModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
