import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ProjectContext,
  HandoffRequest,
  DailyNote,
  DailyNoteEntry,
} from '../types/context';

// ─── Store Interface ────────────────────────────────────────────────────────

interface ContextState {
  // Data (loaded from Supabase)
  projectContexts: ProjectContext[];
  activeContextId: string | null;
  handoffRequests: HandoffRequest[];
  dailyNotes: Record<string, DailyNote[]>; // keyed by agent_id

  // ─── Project Context Actions ──────────────────────────────
  setProjectContexts: (contexts: ProjectContext[]) => void;
  addProjectContext: (context: ProjectContext) => void;
  updateProjectContext: (id: string, updates: Partial<ProjectContext>) => void;
  removeProjectContext: (id: string) => void;
  setActiveContext: (id: string | null) => void;

  // ─── Handoff Actions ──────────────────────────────────────
  setHandoffRequests: (requests: HandoffRequest[]) => void;
  addHandoffRequest: (request: HandoffRequest) => void;
  updateHandoffRequest: (id: string, updates: Partial<HandoffRequest>) => void;
  removeHandoffRequest: (id: string) => void;

  // ─── Daily Notes Actions ──────────────────────────────────
  setDailyNotes: (agentId: string, notes: DailyNote[]) => void;
  appendDailyNoteEntry: (agentId: string, date: string, entry: DailyNoteEntry) => void;
}

const CONTEXT_STORAGE_KEY = 'agora-context-v1';

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      // Initial data
      projectContexts: [],
      activeContextId: null,
      handoffRequests: [],
      dailyNotes: {},

      // Project Context actions
      setProjectContexts: (contexts) => set({ projectContexts: contexts }),
      addProjectContext: (context) =>
        set((state) => {
          const idx = state.projectContexts.findIndex((c) => c.id === context.id);
          if (idx === -1) return { projectContexts: [context, ...state.projectContexts] };
          const updated = [...state.projectContexts];
          updated[idx] = { ...updated[idx], ...context };
          return { projectContexts: updated };
        }),
      updateProjectContext: (id, updates) =>
        set((state) => ({
          projectContexts: state.projectContexts.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      removeProjectContext: (id) =>
        set((state) => ({
          projectContexts: state.projectContexts.filter((c) => c.id !== id),
          activeContextId: state.activeContextId === id ? null : state.activeContextId,
        })),
      setActiveContext: (id) => set({ activeContextId: id }),

      // Handoff actions
      setHandoffRequests: (requests) => set({ handoffRequests: requests }),
      addHandoffRequest: (request) =>
        set((state) => {
          const idx = state.handoffRequests.findIndex((r) => r.id === request.id);
          if (idx === -1) return { handoffRequests: [request, ...state.handoffRequests] };
          const updated = [...state.handoffRequests];
          updated[idx] = { ...updated[idx], ...request };
          return { handoffRequests: updated };
        }),
      updateHandoffRequest: (id, updates) =>
        set((state) => ({
          handoffRequests: state.handoffRequests.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      removeHandoffRequest: (id) =>
        set((state) => ({
          handoffRequests: state.handoffRequests.filter((r) => r.id !== id),
        })),

      // Daily Notes actions
      setDailyNotes: (agentId, notes) =>
        set((state) => ({
          dailyNotes: { ...state.dailyNotes, [agentId]: notes },
        })),
      appendDailyNoteEntry: (agentId, date, entry) =>
        set((state) => {
          const agentNotes = state.dailyNotes[agentId] || [];
          const existingIdx = agentNotes.findIndex((n) => n.date === date);
          let updatedNotes: DailyNote[];
          if (existingIdx >= 0) {
            updatedNotes = agentNotes.map((n, i) =>
              i === existingIdx
                ? { ...n, entries: [...n.entries, entry], updated_at: new Date().toISOString() }
                : n
            );
          } else {
            const newNote: DailyNote = {
              id: `dn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              agent_id: agentId,
              date,
              entries: [entry],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            updatedNotes = [newNote, ...agentNotes];
          }
          return { dailyNotes: { ...state.dailyNotes, [agentId]: updatedNotes } };
        }),
    }),
    {
      name: CONTEXT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeContextId: state.activeContextId,
      }),
    }
  )
);
