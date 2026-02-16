import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Workflow, WorkflowRun, WorkflowSequence } from '../types/workflows';

// ─── Store Interface ────────────────────────────────────────────────────────

interface WorkflowsState {
  // Data (loaded from Supabase, NOT persisted)
  workflows: Workflow[];
  workflowRuns: WorkflowRun[];
  sequences: WorkflowSequence[];

  // UI State (persisted)
  selectedWorkflowId: string | null;
  selectedRunId: string | null;
  activeSubTab: 'workflows' | 'cron' | 'sequences' | 'history';
  editorOpen: boolean;
  searchQuery: string;

  // ─── Workflow Actions ──────────────────────────────────────
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  removeWorkflow: (id: string) => void;

  // ─── Run Actions ───────────────────────────────────────────
  setWorkflowRuns: (runs: WorkflowRun[]) => void;
  addWorkflowRun: (run: WorkflowRun) => void;
  updateWorkflowRun: (id: string, updates: Partial<WorkflowRun>) => void;

  // ─── Sequence Actions ──────────────────────────────────────
  setSequences: (sequences: WorkflowSequence[]) => void;
  addSequence: (sequence: WorkflowSequence) => void;
  updateSequence: (id: string, updates: Partial<WorkflowSequence>) => void;
  removeSequence: (id: string) => void;

  // ─── UI Actions ────────────────────────────────────────────
  selectWorkflow: (id: string | null) => void;
  selectRun: (id: string | null) => void;
  setActiveSubTab: (tab: WorkflowsState['activeSubTab']) => void;
  setEditorOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const WORKFLOWS_STORAGE_KEY = 'agora-workflows-v1';

export const useWorkflowsStore = create<WorkflowsState>()(
  persist(
    (set) => ({
      // Initial data
      workflows: [],
      workflowRuns: [],
      sequences: [],

      // UI State
      selectedWorkflowId: null,
      selectedRunId: null,
      activeSubTab: 'workflows',
      editorOpen: false,
      searchQuery: '',

      // Workflow Actions (upsert pattern)
      setWorkflows: (workflows) => set({ workflows }),
      addWorkflow: (workflow) =>
        set((state) => {
          const idx = state.workflows.findIndex((w) => w.id === workflow.id);
          if (idx === -1) return { workflows: [workflow, ...state.workflows] };
          const workflows = [...state.workflows];
          workflows[idx] = { ...workflows[idx], ...workflow };
          return { workflows };
        }),
      updateWorkflow: (id, updates) =>
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),
      removeWorkflow: (id) =>
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          selectedWorkflowId:
            state.selectedWorkflowId === id ? null : state.selectedWorkflowId,
        })),

      // Run Actions
      setWorkflowRuns: (runs) => set({ workflowRuns: runs }),
      addWorkflowRun: (run) =>
        set((state) => ({
          workflowRuns: [run, ...state.workflowRuns].slice(0, 500),
        })),
      updateWorkflowRun: (id, updates) =>
        set((state) => ({
          workflowRuns: state.workflowRuns.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      // Sequence Actions
      setSequences: (sequences) => set({ sequences }),
      addSequence: (sequence) =>
        set((state) => {
          const idx = state.sequences.findIndex((s) => s.id === sequence.id);
          if (idx === -1) return { sequences: [sequence, ...state.sequences] };
          const sequences = [...state.sequences];
          sequences[idx] = { ...sequences[idx], ...sequence };
          return { sequences };
        }),
      updateSequence: (id, updates) =>
        set((state) => ({
          sequences: state.sequences.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      removeSequence: (id) =>
        set((state) => ({
          sequences: state.sequences.filter((s) => s.id !== id),
        })),

      // UI Actions
      selectWorkflow: (id) => set({ selectedWorkflowId: id }),
      selectRun: (id) => set({ selectedRunId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setEditorOpen: (open) => set({ editorOpen: open }),
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: WORKFLOWS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state
      partialize: (state) => ({
        selectedWorkflowId: state.selectedWorkflowId,
        selectedRunId: state.selectedRunId,
        activeSubTab: state.activeSubTab,
        searchQuery: state.searchQuery,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedWorkflow = () => {
  const workflows = useWorkflowsStore((s) => s.workflows);
  const selectedId = useWorkflowsStore((s) => s.selectedWorkflowId);
  return workflows.find((w) => w.id === selectedId) || null;
};

export const useActiveWorkflows = () => {
  const workflows = useWorkflowsStore((s) => s.workflows);
  return workflows.filter((w) => w.status === 'active');
};

export const useRecentRuns = (limit = 50) => {
  const runs = useWorkflowsStore((s) => s.workflowRuns);
  return runs.slice(0, limit);
};

export const useRunsForWorkflow = (workflowId: string | null) => {
  const runs = useWorkflowsStore((s) => s.workflowRuns);
  if (!workflowId) return [];
  return runs.filter((r) => r.workflow_id === workflowId);
};

export const useFilteredWorkflows = () => {
  const workflows = useWorkflowsStore((s) => s.workflows);
  const searchQuery = useWorkflowsStore((s) => s.searchQuery);

  if (!searchQuery) return workflows;
  const q = searchQuery.toLowerCase();
  return workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(q) ||
      (w.description?.toLowerCase().includes(q) ?? false)
  );
};
