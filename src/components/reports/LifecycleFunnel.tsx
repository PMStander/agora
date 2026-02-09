import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { LifecycleFunnelRow } from '../../types/reports';

interface Props {
  data: LifecycleFunnelRow[];
}

const STATUS_LABELS: Record<string, string> = {
  subscriber: 'Subscriber',
  lead: 'Lead',
  marketing_qualified: 'MQL',
  sales_qualified: 'SQL',
  opportunity: 'Opportunity',
  customer: 'Customer',
  evangelist: 'Evangelist',
  churned: 'Churned',
  other: 'Other',
};

export function LifecycleFunnel({ data }: Props) {
  const chartData = useMemo(() => {
    return data.map((row) => ({
      name: STATUS_LABELS[row.lifecycle_status] || row.lifecycle_status,
      Total: row.total_count,
      'Active 30d': row.active_30d,
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Contact Lifecycle Funnel</h3>
        <p className="text-zinc-500 text-sm">No contacts yet. Add contacts to see the funnel.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Contact Lifecycle Funnel</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#a1a1aa' }}
          />
          <Legend wrapperStyle={{ color: '#a1a1aa' }} />
          <Bar dataKey="Total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Active 30d" fill="#10b981" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
