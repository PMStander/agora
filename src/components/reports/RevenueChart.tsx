import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { RevenueByMonthRow } from '../../types/reports';

interface Props {
  data: RevenueByMonthRow[];
}

export function RevenueChart({ data }: Props) {
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        month: new Date(row.month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        Revenue: Number(row.revenue),
        Deals: row.deal_count,
      }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Revenue by Month</h3>
        <p className="text-zinc-500 text-sm">No revenue data yet. Close deals to track monthly revenue.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Revenue by Month</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="month" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#a1a1aa' }}
            formatter={(value) => `$${(value || 0).toLocaleString()}`}
          />
          <Line
            type="monotone"
            dataKey="Revenue"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
