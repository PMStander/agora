import { useWorkflowsStore } from '../../stores/workflows';
import { useWorkflows } from '../../hooks/useWorkflows';
import { useWorkflowTriggers } from '../../hooks/useWorkflowTriggers';
import { WorkflowList } from './WorkflowList';
import { WorkflowEditor } from './WorkflowEditor';
import { WorkflowRunHistory } from './WorkflowRunHistory';

const SUB_TABS = [
  { id: 'workflows', label: 'Workflows' },
  { id: 'sequences', label: 'Sequences' },
  { id: 'history', label: 'Run History' },
] as const;

export function WorkflowsTab() {
  const { executeWorkflow } = useWorkflows();

  // Mount the trigger listener so active workflows fire automatically
  useWorkflowTriggers(executeWorkflow);

  const activeSubTab = useWorkflowsStore((s) => s.activeSubTab);
  const setActiveSubTab = useWorkflowsStore((s) => s.setActiveSubTab);
  const editorOpen = useWorkflowsStore((s) => s.editorOpen);
  const setEditorOpen = useWorkflowsStore((s) => s.setEditorOpen);

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`
              px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
              ${activeSubTab === tab.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }
            `}
          >
            {tab.label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => {
            useWorkflowsStore.getState().selectWorkflow(null);
            setEditorOpen(true);
          }}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors"
        >
          + New Workflow
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {editorOpen ? (
          <WorkflowEditor onClose={() => setEditorOpen(false)} />
        ) : (
          <>
            {activeSubTab === 'workflows' && <WorkflowList />}
            {activeSubTab === 'sequences' && <SequencesPlaceholder />}
            {activeSubTab === 'history' && <WorkflowRunHistory />}
          </>
        )}
      </div>
    </div>
  );
}

function SequencesPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-zinc-500">
      <div className="text-center">
        <p className="text-lg font-medium mb-2">Sales Sequences</p>
        <p className="text-sm">Multi-step outreach sequences coming soon.</p>
      </div>
    </div>
  );
}
