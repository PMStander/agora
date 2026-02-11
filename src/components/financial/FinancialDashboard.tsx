import { useMemo } from 'react';
import { useFinancialStore, useActiveGoals, useCurrentBudgets } from '../../stores/financial';
import { useFinancialReports } from '../../hooks/useFinancialReports';
import { useRecurringProcessor } from '../../hooks/useRecurringProcessor';
import { TRANSACTION_TYPE_CONFIG } from '../../types/financial';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899'];

export function FinancialDashboard() {
  // Process due recurring items on mount
  useRecurringProcessor();

  const bankAccounts = useFinancialStore((s) => s.bankAccounts);
  const transactions = useFinancialStore((s) => s.transactions);
  const categories = useFinancialStore((s) => s.categories);
  const recurringItems = useFinancialStore((s) => s.recurringItems);
  const goals = useActiveGoals();
  const budgets = useCurrentBudgets();

  const { profitLoss, expensesByCategory, receivablesAging, cashFlow, loading } =
    useFinancialReports();

  // ── Derived KPIs ───────────────────────────────────────────────────────────

  const cashPosition = useMemo(
    () => bankAccounts.filter((a) => a.is_active).reduce((sum, a) => sum + a.current_balance, 0),
    [bankAccounts]
  );

  const outstandingReceivables = useMemo(
    () => receivablesAging.reduce((sum, r) => sum + r.total_outstanding, 0),
    [receivablesAging]
  );

  const currentMonthPL = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return profitLoss.find((r) => r.month?.startsWith(currentMonth)) || {
      total_income: 0,
      total_expenses: 0,
      net_profit: 0,
    };
  }, [profitLoss]);

  const overdueAmount = useMemo(
    () => receivablesAging.reduce((sum, r) => sum + r.days_1_30 + r.days_31_60 + r.days_61_90 + r.days_over_90, 0),
    [receivablesAging]
  );

  // ── Budget Health ────────────────────────────────────────────────────────

  const budgetHealth = useMemo(() => {
    if (budgets.length === 0) return null;

    return budgets.slice(0, 4).map((b) => {
      const periodEnd = getPeriodEnd(b.period_start, b.period_type);
      const cat = categories.find((c) => c.id === b.category_id);
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

      return {
        name: cat?.name || 'Unknown',
        color: cat?.color || '#71717a',
        utilization,
        spent,
        effective,
      };
    });
  }, [budgets, transactions, categories]);

  // ── Recurring Commitments ────────────────────────────────────────────────

  const recurringCommitments = useMemo(() => {
    const active = recurringItems.filter((i) => i.is_active);
    if (active.length === 0) return null;

    const monthlyOut = active
      .filter((i) => i.item_type === 'expense')
      .reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
    const monthlyIn = active
      .filter((i) => i.item_type === 'income' || i.item_type === 'retainer')
      .reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0);
    const overdue = active.filter((i) => new Date(i.next_due_date) < new Date());

    return { monthlyOut, monthlyIn, net: monthlyIn - monthlyOut, overdueCount: overdue.length, count: active.length };
  }, [recurringItems]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  const revenueChartData = useMemo(
    () =>
      [...profitLoss]
        .reverse()
        .slice(-6)
        .map((r) => ({
          month: new Date(r.month).toLocaleDateString('en', { month: 'short' }),
          income: Number(r.total_income),
          expenses: Number(r.total_expenses),
        })),
    [profitLoss]
  );

  const expenseDonutData = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return expensesByCategory
      .filter((r) => r.month?.startsWith(currentMonth))
      .map((r) => ({
        name: r.category_name || 'Uncategorized',
        value: Number(r.total_amount),
        color: r.category_color || '#71717a',
      }));
  }, [expensesByCategory]);

  const cashFlowChartData = useMemo(
    () =>
      [...cashFlow]
        .reverse()
        .slice(-6)
        .map((r) => ({
          month: new Date(r.month).toLocaleDateString('en', { month: 'short' }),
          in: Number(r.cash_in),
          out: Number(r.cash_out),
          net: Number(r.net_cash_flow),
        })),
    [cashFlow]
  );

  const agingData = useMemo(() => {
    if (receivablesAging.length === 0) return [];
    const r = receivablesAging[0];
    return [
      { name: 'Current', value: Number(r.current_amount) },
      { name: '1-30', value: Number(r.days_1_30) },
      { name: '31-60', value: Number(r.days_31_60) },
      { name: '61-90', value: Number(r.days_61_90) },
      { name: '90+', value: Number(r.days_over_90) },
    ].filter((d) => d.value > 0);
  }, [receivablesAging]);

  // ── Recent transactions ────────────────────────────────────────────────────

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)).slice(0, 5),
    [transactions]
  );

  const fmt = (n: number) =>
    n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 animate-pulse">
        Loading financial data...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Cash Position" value={fmt(cashPosition)} color="blue" prefix="R" />
        <KpiCard label="Receivables" value={fmt(outstandingReceivables)} color="amber" prefix="R" />
        <KpiCard label="Revenue (MTD)" value={fmt(Number(currentMonthPL.total_income))} color="green" prefix="R" />
        <KpiCard label="Expenses (MTD)" value={fmt(Number(currentMonthPL.total_expenses))} color="red" prefix="R" />
        <KpiCard
          label="Net Profit"
          value={fmt(Number(currentMonthPL.net_profit))}
          color={Number(currentMonthPL.net_profit) >= 0 ? 'green' : 'red'}
          prefix="R"
        />
        <KpiCard label="Overdue" value={fmt(overdueAmount)} color={overdueAmount > 0 ? 'red' : 'zinc'} prefix="R" />
      </div>

      {/* ── Budget Health (conditional) ──────────────────────────────────── */}
      {budgetHealth && budgetHealth.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Budget Health</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {budgetHealth.map((b, i) => {
              const barColor =
                b.utilization >= 100 ? 'bg-red-500' :
                b.utilization >= 80 ? 'bg-amber-500' :
                b.utilization >= 60 ? 'bg-yellow-500' : 'bg-green-500';
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 truncate">{b.name}</span>
                    <span className={`text-xs font-semibold ${
                      b.utilization >= 100 ? 'text-red-400' :
                      b.utilization >= 80 ? 'text-amber-400' : 'text-green-400'
                    }`}>
                      {b.utilization.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(b.utilization, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-600 font-mono">
                    R{fmt(b.spent)} / R{fmt(b.effective)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Goals Progress (conditional) ─────────────────────────────────── */}
      {goals.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Active Goals</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {goals.slice(0, 4).map((goal) => {
              const progress = goal.target_amount > 0
                ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                : 0;
              return (
                <div key={goal.id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/30">
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                      <circle
                        cx="18" cy="18" r="15.5"
                        fill="none" stroke="#27272a" strokeWidth="3"
                      />
                      <circle
                        cx="18" cy="18" r="15.5"
                        fill="none"
                        stroke={progress >= 100 ? '#22c55e' : progress >= 50 ? '#3b82f6' : '#f59e0b'}
                        strokeWidth="3"
                        strokeDasharray={`${progress} ${100 - progress}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs">
                      {goal.icon || '🎯'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{goal.name}</p>
                    <p className="text-xs text-zinc-500 font-mono">
                      {progress.toFixed(0)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recurring Commitments (conditional) ──────────────────────────── */}
      {recurringCommitments && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-300">Monthly Commitments</h3>
            <span className="text-xs text-zinc-600">{recurringCommitments.count} active</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-zinc-500">Outgoing</p>
              <p className="text-sm font-semibold font-mono text-red-400">
                R{fmt(recurringCommitments.monthlyOut)}/mo
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Incoming</p>
              <p className="text-sm font-semibold font-mono text-green-400">
                R{fmt(recurringCommitments.monthlyIn)}/mo
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Net</p>
              <p className={`text-sm font-semibold font-mono ${recurringCommitments.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                R{fmt(recurringCommitments.net)}/mo
              </p>
            </div>
          </div>
          {recurringCommitments.overdueCount > 0 && (
            <p className="text-xs text-red-400 mt-2">
              ⚠ {recurringCommitments.overdueCount} overdue item{recurringCommitments.overdueCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <ChartCard title="Revenue vs Expenses (6mo)">
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChartData}>
                <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No revenue data yet" />
          )}
        </ChartCard>

        {/* Expense Breakdown */}
        <ChartCard title="Expenses by Category (MTD)">
          {expenseDonutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={expenseDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {expenseDonutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  formatter={(value) => `R${fmt(Number(value))}`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No expenses this month" />
          )}
        </ChartCard>

        {/* Cash Flow */}
        <ChartCard title="Cash Flow (6mo)">
          {cashFlowChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashFlowChartData}>
                <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Bar dataKey="in" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No cash flow data yet" />
          )}
        </ChartCard>

        {/* Receivables Aging */}
        <ChartCard title="Receivables Aging">
          {agingData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agingData}>
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                  formatter={(value) => `R${fmt(Number(value))}`}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {agingData.map((_, i) => (
                    <Cell key={i} fill={['#22c55e', '#eab308', '#f97316', '#ef4444', '#dc2626'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No outstanding receivables" />
          )}
        </ChartCard>
      </div>

      {/* ── Recent Transactions ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">Recent Transactions</h3>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            No transactions yet. Record an expense or receive a payment to get started.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {recentTransactions.map((t) => {
              const typeConfig = TRANSACTION_TYPE_CONFIG[t.transaction_type];
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded text-xs font-mono ${
                      t.transaction_type === 'income'
                        ? 'bg-green-500/20 text-green-400'
                        : t.transaction_type === 'expense'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {typeConfig.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">
                      {t.description || t.payee_name || typeConfig.label}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(t.transaction_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-mono ${
                      t.transaction_type === 'income' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {t.transaction_type === 'income' ? '+' : '-'}R{fmt(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-zinc-600 pb-4">
        Financial insights for business planning. Not a substitute for professional accounting.
      </p>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
  prefix = '',
}: {
  label: string;
  value: string;
  color: string;
  prefix?: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    zinc: 'text-zinc-400',
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold font-mono ${colorMap[color] || 'text-zinc-200'}`}>
        {prefix}{value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">
      {label}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodEnd(periodStart: string, periodType: string): string {
  const d = new Date(periodStart);
  switch (periodType) {
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

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
