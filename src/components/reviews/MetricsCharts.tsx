import type { ReviewMetrics } from '../../types/reviews';

interface MetricsChartsProps {
  metrics: ReviewMetrics;
}

function BarChart({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300">{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RateBar({ label, rate }: { label: string; rate: number }) {
  const pct = Math.min(100, rate * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MetricsCharts({ metrics }: MetricsChartsProps) {
  const tc = metrics.task_completion;
  const maxTasks = Math.max(tc.total_assigned, 1);

  return (
    <div className="space-y-6">
      {/* Task Completion */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Task Completion</h4>
        <div className="space-y-2">
          <BarChart label="Completed" value={tc.completed} max={maxTasks} color="bg-emerald-500" />
          <BarChart label="Failed" value={tc.failed} max={maxTasks} color="bg-red-500" />
          <BarChart label="Timed Out" value={tc.timed_out} max={maxTasks} color="bg-orange-500" />
          <RateBar label="Completion Rate" rate={tc.completion_rate} />
        </div>
      </div>

      {/* Quality */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Quality</h4>
        <div className="space-y-2">
          <RateBar label="First-Pass Approval" rate={metrics.quality.review_pass_rate} />
          <BarChart label="Avg Revision Rounds" value={metrics.quality.avg_revision_rounds} max={5} color="bg-blue-500" />
          <RateBar label="Proof Verified" rate={metrics.quality.proof_verified_rate} />
        </div>
      </div>

      {/* Speed */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Speed</h4>
        <div className="space-y-2">
          <BarChart
            label="Avg Completion (min)"
            value={metrics.speed.avg_completion_minutes}
            max={Math.max(metrics.speed.slowest_task_minutes, 60)}
            color="bg-cyan-500"
          />
          <BarChart
            label="Fastest (min)"
            value={metrics.speed.fastest_task_minutes}
            max={Math.max(metrics.speed.slowest_task_minutes, 60)}
            color="bg-emerald-400"
          />
          <BarChart
            label="Slowest (min)"
            value={metrics.speed.slowest_task_minutes}
            max={Math.max(metrics.speed.slowest_task_minutes, 60)}
            color="bg-orange-400"
          />
        </div>
      </div>

      {/* Guardrails */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3">Guardrails</h4>
        <div className="space-y-2">
          <RateBar label="Compliance Rate" rate={metrics.guardrails.compliance_rate} />
          <BarChart label="Violations" value={metrics.guardrails.violations} max={10} color="bg-red-500" />
          <BarChart label="Near Misses" value={metrics.guardrails.near_misses} max={10} color="bg-yellow-500" />
        </div>
      </div>
    </div>
  );
}
