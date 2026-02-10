import { useMemo } from 'react';
import { useFinancialStore } from '../../stores/financial';
import { useFinancialReports } from '../../hooks/useFinancialReports';
import { TRANSACTION_TYPE_CONFIG } from '../../types/financial';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899'];

export function FinancialDashboard() {
  const bankAccounts = useFinancialStore((s) => s.bankAccounts);
  const transactions = useFinancialStore((s) => s.transactions);

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
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
        <KpiCard label="Cash Position" value={fmt(cashPosition)} color="blue" prefix="$" />
        <KpiCard label="Receivables" value={fmt(outstandingReceivables)} color="amber" prefix="$" />
        <KpiCard label="Revenue (MTD)" value={fmt(Number(currentMonthPL.total_income))} color="green" prefix="$" />
        <KpiCard label="Expenses (MTD)" value={fmt(Number(currentMonthPL.total_expenses))} color="red" prefix="$" />
        <KpiCard
          label="Net Profit"
          value={fmt(Number(currentMonthPL.net_profit))}
          color={Number(currentMonthPL.net_profit) >= 0 ? 'green' : 'red'}
          prefix="$"
        />
        <KpiCard label="Overdue" value={fmt(overdueAmount)} color={overdueAmount > 0 ? 'red' : 'zinc'} prefix="$" />
      </div>

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
                  formatter={(value) => `$${fmt(Number(value))}`}
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
                  formatter={(value) => `$${fmt(Number(value))}`}
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
                    {t.transaction_type === 'income' ? '+' : '-'}${fmt(t.amount)}
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
