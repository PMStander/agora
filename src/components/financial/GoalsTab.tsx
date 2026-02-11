import { useState } from 'react';
import { useFinancialStore, useActiveGoals } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';
import { GOAL_STATUS_CONFIG } from '../../types/financial';
import type { GoalType, FinancialContext } from '../../types/financial';

const GOAL_ICONS: Record<string, string> = {
  savings: '🏦',
  revenue: '📈',
  expense_reduction: '📉',
  custom: '🎯',
};

export function GoalsTab() {
  const { createGoal, deleteGoal, createGoalContribution } = useFinancial();
  const goals = useActiveGoals();
  const allGoals = useFinancialStore((s) => s.goals);
  const financialContext = useFinancialStore((s) => s.financialContext);
  const selectGoal = useFinancialStore((s) => s.selectGoal);

  const [showCreate, setShowCreate] = useState(false);
  const [showContribute, setShowContribute] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<GoalType>('savings');
  const [newTarget, setNewTarget] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newContext, setNewContext] = useState<FinancialContext>(
    financialContext === 'all' ? 'business' : financialContext as FinancialContext
  );
  const [contribAmount, setContribAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCreate = async () => {
    if (!newName.trim() || !newTarget) return;
    setSaving(true);
    await createGoal({
      name: newName.trim(),
      goal_type: newType,
      target_amount: parseFloat(newTarget),
      current_amount: 0,
      currency: 'ZAR',
      target_date: newDate || null,
      period_type: null,
      status: 'active',
      category_id: null,
      bank_account_id: null,
      color: null,
      icon: GOAL_ICONS[newType] || null,
      context: newContext,
      notes: null,
    });
    setSaving(false);
    setShowCreate(false);
    setNewName('');
    setNewTarget('');
    setNewDate('');
  };

  const handleContribute = async () => {
    if (!showContribute || !contribAmount) return;
    setSaving(true);
    await createGoalContribution({
      goal_id: showContribute,
      transaction_id: null,
      amount: parseFloat(contribAmount),
      contribution_date: new Date().toISOString().split('T')[0],
      notes: null,
    });
    setSaving(false);
    setShowContribute(null);
    setContribAmount('');
  };

  // Include achieved/cancelled for display
  const inactiveGoals = allGoals.filter((g) => g.status !== 'active' && (financialContext === 'all' || g.context === financialContext));

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200">Financial Goals</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track savings, revenue targets, and milestones
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          + Set Goal
        </button>
      </div>

      {/* Active goals */}
      {goals.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500 text-sm">No active goals.</p>
          <p className="text-zinc-600 text-xs mt-1">
            Set a savings target or revenue goal to track your progress.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const progress = goal.target_amount > 0
              ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
              : 0;
            const remaining = goal.target_amount - goal.current_amount;
            const daysLeft = goal.target_date
              ? Math.max(0, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : null;
            const dailyNeeded = daysLeft && daysLeft > 0 && remaining > 0
              ? remaining / daysLeft
              : 0;

            // Determine status label
            const statusLabel = remaining <= 0
              ? 'Achieved!'
              : daysLeft !== null
                ? daysLeft === 0
                  ? 'Due today'
                  : `${daysLeft} days left`
                : 'No deadline';

            return (
              <div
                key={goal.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors cursor-pointer"
                onClick={() => selectGoal(goal.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{goal.icon || GOAL_ICONS[goal.goal_type]}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">{goal.name}</h3>
                      <p className="text-xs text-zinc-500 capitalize">{goal.goal_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  {goal.context === 'personal' && (
                    <span className="text-xs text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded">personal</span>
                  )}
                </div>

                {/* Progress ring (simplified as bar for now) */}
                <div className="mb-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-lg font-mono font-semibold text-zinc-200">
                      R{fmt(goal.current_amount)}
                    </span>
                    <span className="text-sm font-mono text-zinc-500">
                      / R{fmt(goal.target_amount)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress >= 100 ? 'bg-green-500' :
                        progress >= 75 ? 'bg-blue-500' :
                        progress >= 50 ? 'bg-amber-500' : 'bg-zinc-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className={`text-xs font-semibold ${
                      progress >= 100 ? 'text-green-400' : 'text-zinc-400'
                    }`}>
                      {progress.toFixed(1)}%
                    </span>
                    <span className="text-xs text-zinc-500">{statusLabel}</span>
                  </div>
                </div>

                {/* Daily target */}
                {dailyNeeded > 0 && (
                  <p className="text-xs text-zinc-500 mb-3">
                    Need R{fmt(dailyNeeded)}/day to reach target
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowContribute(goal.id); }}
                    className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                  >
                    + Add Funds
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Cancel "${goal.name}"?`)) deleteGoal(goal.id);
                    }}
                    className="px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed / cancelled goals */}
      {inactiveGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Past Goals</h3>
          <div className="space-y-2">
            {inactiveGoals.map((goal) => {
              const statusConfig = GOAL_STATUS_CONFIG[goal.status];
              return (
                <div key={goal.id} className="flex items-center gap-3 px-4 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                  <span className="text-sm">{goal.icon || GOAL_ICONS[goal.goal_type]}</span>
                  <span className="text-sm text-zinc-500 flex-1">{goal.name}</span>
                  <span className="text-xs font-mono text-zinc-600">
                    R{fmt(goal.current_amount)} / R{fmt(goal.target_amount)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    statusConfig.color === 'green' ? 'bg-green-500/20 text-green-400' :
                    statusConfig.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-zinc-700 text-zinc-400'
                  }`}>
                    {statusConfig.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Goal Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-200">Set a Goal</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Goal Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New Equipment Fund"
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as GoalType)}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="savings">Savings</option>
                    <option value="revenue">Revenue Target</option>
                    <option value="expense_reduction">Expense Reduction</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Target Amount (ZAR) *</label>
                  <input
                    type="number"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="500000"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Context</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setNewContext('business')}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${
                        newContext === 'business' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 bg-zinc-800'
                      }`}
                    >
                      💼 Business
                    </button>
                    <button
                      onClick={() => setNewContext('personal')}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${
                        newContext === 'personal' ? 'bg-green-500/20 text-green-400' : 'text-zinc-500 bg-zinc-800'
                      }`}
                    >
                      👤 Personal
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim() || !newTarget}
                className="px-4 py-2 text-sm bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Set Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContribute && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-200">Add to Goal</h2>
              <button onClick={() => setShowContribute(null)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
            <div className="p-5">
              <label className="block text-xs text-zinc-400 mb-1">Amount (ZAR)</label>
              <input
                type="number"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                placeholder="10000"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <button onClick={() => setShowContribute(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button
                onClick={handleContribute}
                disabled={saving || !contribAmount}
                className="px-4 py-2 text-sm bg-green-500 text-zinc-900 font-semibold rounded-lg hover:bg-green-400 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Add Funds'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
