import { useState } from 'react';
import { useFinancialStore } from '../../stores/financial';
import { useCashFlowForecast } from '../../hooks/useCashFlowForecast';
import type { ForecastScenario } from '../../types/financial';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const SCENARIOS: { id: ForecastScenario; label: string; color: string }[] = [
  { id: 'optimistic',  label: 'Optimistic',  color: 'green' },
  { id: 'realistic',   label: 'Realistic',   color: 'blue' },
  { id: 'pessimistic', label: 'Pessimistic', color: 'red' },
];

const MONTH_RANGE_OPTIONS = [3, 6, 9, 12];

export function CashFlowForecast() {
  const setForecastMonths = useFinancialStore((s) => s.setForecastMonths);
  const forecastMonths = useFinancialStore((s) => s.forecastMonths);
  const [scenario, setScenario] = useState<ForecastScenario>('realistic');

  const { chartData, summary } = useCashFlowForecast(scenario);

  const fmt = (n: number) =>
    n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const fmtFull = (n: number) =>
    n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-200">Cash Flow Forecast</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Projected cash position based on recurring commitments and historical patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month range selector */}
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-800/50 p-0.5">
            {MONTH_RANGE_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setForecastMonths(m)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  forecastMonths === m
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {m}mo
              </button>
            ))}
          </div>

          {/* Scenario pills */}
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-800/50 p-0.5">
            {SCENARIOS.map((s) => {
              const colorMap: Record<string, string> = {
                green: 'bg-green-500/20 text-green-400',
                blue: 'bg-blue-500/20 text-blue-400',
                red: 'bg-red-500/20 text-red-400',
              };
              return (
                <button
                  key={s.id}
                  onClick={() => setScenario(s.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    scenario === s.id
                      ? colorMap[s.color]
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Current Cash"
          value={`R${fmtFull(summary.cashPosition)}`}
          color="blue"
        />
        <KpiCard
          label={`Projected (${forecastMonths}mo)`}
          value={`R${fmtFull(summary.endBalance)}`}
          color={summary.endBalance >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          label="Lowest Point"
          value={`R${fmtFull(summary.lowestBalance)}`}
          color={summary.lowestBalance >= 0 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Runway"
          value={
            summary.monthsUntilNegative === null
              ? `${forecastMonths}+ months`
              : `${summary.monthsUntilNegative} months`
          }
          color={
            summary.monthsUntilNegative === null
              ? 'green'
              : summary.monthsUntilNegative >= 6
              ? 'amber'
              : 'red'
          }
        />
      </div>

      {/* Forecast Chart */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          Income vs Expenses — Historical + Projected
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R${fmt(v)}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#a1a1aa' }}
                formatter={(value: number | undefined, name: string | undefined) => [
                  `R${fmtFull(value ?? 0)}`,
                  name === 'income' ? 'Income' : name === 'expenses' ? 'Expenses' : 'Net',
                ]}
              />
              {/* Reference line at the boundary between historical and projected */}
              <ReferenceLine
                x={chartData.find((d) => d.isProjected)?.month}
                stroke="#52525b"
                strokeDasharray="4 4"
                label={{
                  value: 'Projected →',
                  position: 'top',
                  fill: '#71717a',
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#22c55e"
                fill="url(#incomeGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                fill="url(#expenseGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-zinc-600 text-sm">
            Add recurring items and transactions to generate a forecast
          </div>
        )}
      </div>

      {/* Net Cash Flow Bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          Cumulative Balance
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData.filter((d) => d.isProjected)}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R${fmt(v)}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                }}
                formatter={(value: number | undefined) => [`R${fmtFull(value ?? 0)}`, 'Net']}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#3b82f6"
                fill="url(#balanceGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">
            No forecast data available
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-xs text-zinc-600 pb-4">
        Projections based on recurring commitments and historical patterns. Not financial advice.
      </p>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
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
        {value}
      </p>
    </div>
  );
}
