import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { DealConversionRow } from '../../types/reports';

interface Props {
  data: DealConversionRow[];
}

export function DealConversionChart({ data }: Props) {
  const chartData = useMemo(() => {
    return data.map((row) => ({
      name: row.pipeline_name,
      Won: row.won,
      Lost: row.lost,
      Open: row.open,
      'Win Rate': Number(row.win_rate),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Deal Conversion</h3>
        <p className="text-zinc-500 text-sm">No deal data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Deal Conversion</h3>
      <div className="flex gap-4 mb-4">
        {data.map((row) => (
          <div key={row.pipeline_id} className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">{row.pipeline_name}</span>
            <span className="text-amber-400 font-semibold">{row.win_rate}% win rate</span>
            <span>({row.total} total)</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#a1a1aa' }}
          />
          <Legend wrapperStyle={{ color: '#a1a1aa' }} />
          <Bar dataKey="Won" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Lost" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Open" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
