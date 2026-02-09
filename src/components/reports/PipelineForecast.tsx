import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { PipelineForecastRow } from '../../types/reports';

interface Props {
  data: PipelineForecastRow[];
}

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

export function PipelineForecast({ data }: Props) {
  const chartData = useMemo(() => {
    // Group by pipeline, then show stages as bars
    const pipelines = new Map<string, { name: string; stages: PipelineForecastRow[] }>();
    for (const row of data) {
      if (!pipelines.has(row.pipeline_id)) {
        pipelines.set(row.pipeline_id, { name: row.pipeline_name, stages: [] });
      }
      pipelines.get(row.pipeline_id)!.stages.push(row);
    }

    // Flatten: one bar per stage, grouped by pipeline
    return data.map((row) => ({
      name: row.stage_name,
      pipeline: row.pipeline_name,
      'Deal Count': row.deal_count,
      'Total Value': Number(row.total_value),
      'Weighted Value': Number(row.weighted_value),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Pipeline Forecast</h3>
        <p className="text-zinc-500 text-sm">No pipeline data available. Create deals to see forecast data.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Pipeline Forecast</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
            labelStyle={{ color: '#e4e4e7' }}
            itemStyle={{ color: '#a1a1aa' }}
            formatter={(value) => `$${(value || 0).toLocaleString()}`}
          />
          <Legend wrapperStyle={{ color: '#a1a1aa' }} />
          <Bar dataKey="Total Value" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
          <Bar dataKey="Weighted Value" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
