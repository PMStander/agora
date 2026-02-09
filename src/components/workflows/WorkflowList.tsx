import { useWorkflowsStore, useFilteredWorkflows } from '../../stores/workflows';
import { useWorkflows } from '../../hooks/useWorkflows';
import {
  WORKFLOW_STATUS_CONFIG,
  TRIGGER_TYPE_CONFIG,
} from '../../types/workflows';

export function WorkflowList() {
  const workflows = useFilteredWorkflows();
  const searchQuery = useWorkflowsStore((s) => s.searchQuery);
  const setSearchQuery = useWorkflowsStore((s) => s.setSearchQuery);
  const selectWorkflow = useWorkflowsStore((s) => s.selectWorkflow);
  const setEditorOpen = useWorkflowsStore((s) => s.setEditorOpen);
  const { toggleWorkflow, executeWorkflow, deleteWorkflow } = useWorkflows();

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <input
          type="text"
          placeholder="Search workflows..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {workflows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            {searchQuery ? 'No workflows match your search.' : 'No workflows yet. Create one to get started.'}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {workflows.map((workflow) => {
              const statusConfig = WORKFLOW_STATUS_CONFIG[workflow.status];
              const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger_type];
              const isActive = workflow.status === 'active';

              return (
                <div
                  key={workflow.id}
                  className="px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => {
                            selectWorkflow(workflow.id);
                            setEditorOpen(true);
                          }}
                          className="text-sm font-medium text-zinc-200 hover:text-amber-400 truncate text-left"
                        >
                          {workflow.name}
                        </button>
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded font-medium
                            ${statusConfig.color === 'green'
                              ? 'bg-green-500/20 text-green-400'
                              : statusConfig.color === 'amber'
                              ? 'bg-amber-500/20 text-amber-400'
                              : statusConfig.color === 'red'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-zinc-700 text-zinc-400'
                            }`}
                        >
                          {statusConfig.label}
                        </span>
                      </div>

                      {workflow.description && (
                        <p className="text-xs text-zinc-500 truncate mb-1">
                          {workflow.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span>{triggerConfig.label}</span>
                        {workflow.trigger_entity && (
                          <span className="capitalize">{workflow.trigger_entity}</span>
                        )}
                        <span>{workflow.actions.length} action{workflow.actions.length !== 1 ? 's' : ''}</span>
                        {workflow.run_count > 0 && (
                          <span>{workflow.run_count} run{workflow.run_count !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Toggle active/paused */}
                      <button
                        onClick={() => toggleWorkflow(workflow.id)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          isActive ? 'bg-green-500' : 'bg-zinc-700'
                        }`}
                        title={isActive ? 'Pause workflow' : 'Activate workflow'}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            isActive ? 'left-4.5' : 'left-0.5'
                          }`}
                          style={{ transform: isActive ? 'translateX(0)' : 'translateX(0)' , left: isActive ? '18px' : '2px' }}
                        />
                      </button>

                      {/* Manual run */}
                      {workflow.status !== 'archived' && (
                        <button
                          onClick={() =>
                            executeWorkflow(workflow.id, { source: 'manual' })
                          }
                          className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                          title="Run manually"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                          </svg>
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => {
                          if (confirm(`Delete workflow "${workflow.name}"?`))
                            deleteWorkflow(workflow.id);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
