import type { DomainPerformance } from '../../types/reviews';

interface DomainBreakdownProps {
  domains: DomainPerformance[];
}

export function DomainBreakdown({ domains }: DomainBreakdownProps) {
  if (domains.length === 0) {
    return (
      <div className="text-center text-zinc-600 py-4">
        <p className="text-sm">No domain data available</p>
      </div>
    );
  }

  const maxTasks = Math.max(...domains.map((d) => d.tasks_completed), 1);

  return (
    <div className="space-y-3">
      {domains.map((domain) => {
        const qualityPct = Math.min(100, domain.avg_quality_score * 100);
        const tasksPct = (domain.tasks_completed / maxTasks) * 100;

        return (
          <div key={domain.domain} className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-300 capitalize">{domain.domain}</span>
              <span className="text-xs text-zinc-500">{domain.tasks_completed} tasks</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${tasksPct}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">
                <span className={`text-xs font-medium ${qualityPct >= 80 ? 'text-emerald-400' : qualityPct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {qualityPct.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
