import { useState, useMemo } from 'react';
import { useFinancialStore, useCurrentBudgets, useActiveCategories } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';
import type { FinancialContext, BudgetPeriodType } from '../../types/financial';

export function BudgetsTab() {
  const { createBudget, deleteBudget } = useFinancial();
  const budgets = useCurrentBudgets();
  const categories = useActiveCategories('expense');
  const transactions = useFinancialStore((s) => s.transactions);
  const selectedPeriod = useFinancialStore((s) => s.selectedBudgetPeriod);
  const selectBudgetPeriod = useFinancialStore((s) => s.selectBudgetPeriod);
  const financialContext = useFinancialStore((s) => s.financialContext);

  const [showCreate, setShowCreate] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newPeriodType, setNewPeriodType] = useState<BudgetPeriodType>('monthly');
  const [newRollover, setNewRollover] = useState(false);
  const [saving, setSaving] = useState(false);

  // Default to current month
  const currentPeriod = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const activePeriod = selectedPeriod || currentPeriod;

  // Compute actual spent per category for the active period
  const budgetData = useMemo(() => {
    return budgets.map((b) => {
      const periodEnd = getPeriodEnd(b.period_start, b.period_type);
      const spent = transactions
        .filter(
          (t) =>
            t.transaction_type === 'expense' &&
            t.status !== 'void' &&
            t.category_id === b.category_id &&
            t.transaction_date >= b.period_start &&
            t.transaction_date < periodEnd
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const effective = b.amount + b.rollover_amount;
      const utilization = effective > 0 ? (spent / effective) * 100 : 0;
      const variance = effective - spent;

      return { ...b, spent, effective, utilization, variance };
    });
  }, [budgets, transactions]);

  const totalBudgeted = budgetData.reduce((s, b) => s + b.effective, 0);
  const totalSpent = budgetData.reduce((s, b) => s + b.spent, 0);

  const fmt = (n: number) =>
    n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCreate = async () => {
    if (!newCategoryId || !newAmount) return;
    setSaving(true);
    const periodStart = `${activePeriod}-01`;
    await createBudget({
      category_id: newCategoryId,
      period_type: newPeriodType,
      period_start: periodStart,
      amount: parseFloat(newAmount),
      currency: 'ZAR',
      rollover: newRollover,
      rollover_amount: 0,
      context: (financialContext === 'all' ? 'business' : financialContext) as FinancialContext,
      notes: null,
    });
    setSaving(false);
    setShowCreate(false);
    setNewCategoryId('');
    setNewAmount('');
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200">Budgets</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Set spending limits per category and track variance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <input
            type="month"
            value={activePeriod}
            onChange={(e) => selectBudgetPeriod(e.target.value)}
            className="px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            + Create Budget
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 mb-1">Total Budgeted</p>
          <p className="text-lg font-semibold font-mono text-zinc-200">R{fmt(totalBudgeted)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 mb-1">Total Spent</p>
          <p className="text-lg font-semibold font-mono text-red-400">R{fmt(totalSpent)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 mb-1">Remaining</p>
          <p className={`text-lg font-semibold font-mono ${totalBudgeted - totalSpent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            R{fmt(totalBudgeted - totalSpent)}
          </p>
        </div>
      </div>

      {/* Budget cards */}
      {budgetData.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500 text-sm">No budgets set for this period.</p>
          <p className="text-zinc-600 text-xs mt-1">
            Create a budget to track spending against your limits.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgetData.map((b) => {
            const cat = categories.find((c) => c.id === b.category_id);
            const barColor =
              b.utilization >= 100 ? 'bg-red-500' :
              b.utilization >= 80 ? 'bg-amber-500' :
              b.utilization >= 60 ? 'bg-yellow-500' : 'bg-green-500';

            return (
              <div
                key={b.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {cat?.color && (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    )}
                    <span className="text-sm font-medium text-zinc-200">
                      {cat?.name || 'Unknown Category'}
                    </span>
                    {b.rollover && (
                      <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">rollover</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-zinc-400">
                      R{fmt(b.spent)} / R{fmt(b.effective)}
                    </span>
                    <span className={`text-xs font-semibold ${
                      b.utilization >= 100 ? 'text-red-400' :
                      b.utilization >= 80 ? 'text-amber-400' : 'text-green-400'
                    }`}>
                      {b.utilization.toFixed(1)}%
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete this budget?`)) deleteBudget(b.id);
                      }}
                      className="text-zinc-600 hover:text-red-400 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(b.utilization, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-zinc-600">
                    R{fmt(b.variance)} {b.variance >= 0 ? 'remaining' : 'over budget'}
                  </span>
                  <span className="text-xs text-zinc-600">{b.period_type}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-200">Create Budget</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Category *</label>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Amount (ZAR) *</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="50000"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Period</label>
                  <select
                    value={newPeriodType}
                    onChange={(e) => setNewPeriodType(e.target.value as BudgetPeriodType)}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={newRollover} onChange={(e) => setNewRollover(e.target.checked)} className="rounded border-zinc-600" />
                Carry unused budget to next period (rollover)
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={saving || !newCategoryId || !newAmount}
                className="px-4 py-2 text-sm bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Create Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodEnd(periodStart: string, periodType: string): string {
  const d = new Date(periodStart);
  switch (periodType) {
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}
