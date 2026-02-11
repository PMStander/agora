import { useState, useMemo } from 'react';
import { useFinancialStore, useRecurringByType } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';
import { RECURRING_TYPE_CONFIG, FREQUENCY_CONFIG } from '../../types/financial';
import type { RecurringItemType, RecurringItem } from '../../types/financial';
import { RecurringItemForm } from './RecurringItemForm';

type FilterType = RecurringItemType | 'all';

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'expense',  label: 'Outgoing' },
  { id: 'income',   label: 'Incoming' },
  { id: 'retainer', label: 'Retainers' },
];

export function RecurringTab() {
  const { deleteRecurringItem } = useFinancial();
  const selectRecurringItem = useFinancialStore((s) => s.selectRecurringItem);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editItem, setEditItem] = useState<RecurringItem | null>(null);

  const allRecurring = useRecurringByType(filterType === 'all' ? undefined : filterType);

  // Monthly commitment summary
  const summary = useMemo(() => {
    const items = useFinancialStore.getState().recurringItems.filter((i) => i.is_active);
    const monthlyOut = items
      .filter((i) => i.item_type === 'expense')
      .reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
    const monthlyIn = items
      .filter((i) => i.item_type === 'income' || i.item_type === 'retainer')
      .reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
    return { monthlyOut, monthlyIn, net: monthlyIn - monthlyOut };
  }, [allRecurring]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) =>
    n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200">Recurring Items</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Fixed expenses, recurring income, and client retainers
          </p>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowCreateModal(true); }}
          className="px-4 py-2 text-sm bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          + Add Recurring
        </button>
      </div>

      {/* Monthly commitment summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 mb-1">Monthly Outgoing</p>
          <p className="text-lg font-semibold font-mono text-red-400">
            R{fmt(summary.monthlyOut)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 mb-1">Monthly Incoming</p>
          <p className="text-lg font-semibold font-mono text-green-400">
            R{fmt(summary.monthlyIn)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 mb-1">Net Monthly</p>
          <p className={`text-lg font-semibold font-mono ${summary.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            R{fmt(summary.net)}
          </p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilterType(opt.id)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
              ${filterType === opt.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }
            `}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-600">
          {allRecurring.length} item{allRecurring.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {allRecurring.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500 text-sm">
            No recurring items yet.
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            Add your rent, subscriptions, or client retainers to track monthly commitments.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800">
          {allRecurring.map((item) => {
            const typeConfig = RECURRING_TYPE_CONFIG[item.item_type];
            const freqConfig = FREQUENCY_CONFIG[item.frequency];
            const isOverdue = new Date(item.next_due_date) < new Date();

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                onClick={() => selectRecurringItem(item.id)}
              >
                {/* Type badge */}
                <span
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                    item.item_type === 'expense'
                      ? 'bg-red-500/20 text-red-400'
                      : item.item_type === 'retainer'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {typeConfig.icon}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-200 truncate">{item.name}</p>
                    {item.item_type === 'retainer' && item.company_id && (
                      <span className="text-xs text-purple-400/70 bg-purple-500/10 px-1.5 py-0.5 rounded">
                        retainer
                      </span>
                    )}
                    {item.context === 'personal' && (
                      <span className="text-xs text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded">
                        personal
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-zinc-500">
                      {freqConfig.label}
                    </p>
                    {item.payee_name && (
                      <p className="text-xs text-zinc-600">
                        · {item.payee_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <p className={`text-sm font-mono font-semibold ${
                    item.item_type === 'expense' ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {item.item_type === 'expense' ? '-' : '+'}R{fmt(item.amount)}{freqConfig.short}
                  </p>
                  <p className={`text-xs ${isOverdue ? 'text-red-400' : 'text-zinc-500'}`}>
                    {isOverdue ? 'Overdue' : 'Next'}: {new Date(item.next_due_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditItem(item); setShowCreateModal(true); }}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Deactivate "${item.name}"?`)) deleteRecurringItem(item.id);
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Deactivate"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <RecurringItemForm
          editItem={editItem}
          onClose={() => { setShowCreateModal(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':    return amount * 4.33;
    case 'biweekly':  return amount * 2.17;
    case 'monthly':   return amount;
    case 'quarterly': return amount / 3;
    case 'yearly':    return amount / 12;
    default:          return amount;
  }
}
