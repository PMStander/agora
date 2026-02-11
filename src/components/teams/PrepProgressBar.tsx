import { useAgentStore } from '../../stores/agents';
import { useBoardroomStore } from '../../stores/boardroom';
import type { PrepResult } from '../../types/boardroom';

interface PrepProgressBarProps {
  sessionId: string;
  results: PrepResult[];
}

const DOT_COLORS: Record<string, string> = {
  pending: 'bg-zinc-600',
  running: 'bg-amber-500 animate-pulse',
  completed: 'bg-emerald-500',
  error: 'bg-red-500',
};

export function PrepProgressBar({ sessionId, results }: PrepProgressBarProps) {
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const streamingContent = useBoardroomStore((s) => s.prepStreamingContent[sessionId] || {});

  const completed = results.filter((r) => r.status === 'completed').length;
  const total = results.length;

  return (
    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
          Preparation
        </span>
        <span className="text-[10px] text-zinc-500">
          {completed}/{total} complete
        </span>
      </div>

      <div className="flex gap-3 flex-wrap">
        {results.map((result) => {
          const agent = agentProfiles[result.agent_id];
          const dot = DOT_COLORS[result.status] || DOT_COLORS.pending;
          const preview = streamingContent[result.agent_id];

          return (
            <div key={result.agent_id} className="flex items-center gap-1.5 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              <span className="text-xs">{agent?.emoji || '?'}</span>
              <span className="text-[10px] text-zinc-400 truncate max-w-24">
                {agent?.name || result.agent_id}
              </span>
              {result.status === 'running' && preview && (
                <span className="text-[10px] text-zinc-600 truncate max-w-32 italic">
                  {preview.slice(0, 60)}...
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-500"
          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
