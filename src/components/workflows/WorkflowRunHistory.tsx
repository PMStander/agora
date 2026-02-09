import { useState } from 'react';
import { useRecentRuns, useWorkflowsStore } from '../../stores/workflows';
import { WORKFLOW_RUN_STATUS_CONFIG } from '../../types/workflows';
import type { WorkflowRun } from '../../types/workflows';

export function WorkflowRunHistory() {
  const runs = useRecentRuns(100);
  const workflows = useWorkflowsStore((s) => s.workflows);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const getWorkflowName = (workflowId: string) =>
    workflows.find((w) => w.id === workflowId)?.name || 'Unknown Workflow';

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-300">
          Run History ({runs.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            No workflow runs yet.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                workflowName={getWorkflowName(run.workflow_id)}
                expanded={expandedRunId === run.id}
                onToggle={() =>
                  setExpandedRunId(expandedRunId === run.id ? null : run.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RunRow({
  run,
  workflowName,
  expanded,
  onToggle,
}: {
  run: WorkflowRun;
  workflowName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig = WORKFLOW_RUN_STATUS_CONFIG[run.status];
  const startedAt = new Date(run.started_at);
  const duration = run.completed_at
    ? Math.round(
        (new Date(run.completed_at).getTime() - startedAt.getTime()) / 1000
      )
    : null;

  return (
    <div className="px-4 py-3">
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                statusConfig.color === 'green'
                  ? 'bg-green-400'
                  : statusConfig.color === 'blue'
                  ? 'bg-blue-400 animate-pulse'
                  : statusConfig.color === 'red'
                  ? 'bg-red-400'
                  : statusConfig.color === 'amber'
                  ? 'bg-amber-400'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="text-sm text-zinc-200 truncate">
              {workflowName}
            </span>
            <span
              className={`px-1.5 py-0.5 text-xs rounded font-medium shrink-0
                ${statusConfig.color === 'green'
                  ? 'bg-green-500/20 text-green-400'
                  : statusConfig.color === 'blue'
                  ? 'bg-blue-500/20 text-blue-400'
                  : statusConfig.color === 'red'
                  ? 'bg-red-500/20 text-red-400'
                  : statusConfig.color === 'amber'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-zinc-700 text-zinc-400'
                }`}
            >
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0">
            <span>
              {run.steps_completed}/{run.steps_total} steps
            </span>
            {duration !== null && <span>{duration}s</span>}
            <span>{startedAt.toLocaleString()}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 ml-4 p-3 bg-zinc-800/50 rounded-lg space-y-2 text-xs">
          <div className="flex gap-4">
            <div>
              <span className="text-zinc-500">Entity:</span>{' '}
              <span className="text-zinc-300">
                {run.entity_type || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Entity ID:</span>{' '}
              <span className="text-zinc-300 font-mono">
                {run.entity_id ? run.entity_id.slice(0, 8) + '...' : 'N/A'}
              </span>
            </div>
          </div>

          {run.error_message && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-300">
              {run.error_message}
            </div>
          )}

          {run.trigger_payload &&
            Object.keys(run.trigger_payload).length > 0 && (
              <details className="text-zinc-500">
                <summary className="cursor-pointer hover:text-zinc-300">
                  Trigger payload
                </summary>
                <pre className="mt-1 p-2 bg-zinc-900 rounded text-xs overflow-x-auto text-zinc-400">
                  {JSON.stringify(run.trigger_payload, null, 2)}
                </pre>
              </details>
            )}
        </div>
      )}
    </div>
  );
}
