import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DocumentCategory,
  DocumentCenterFilters,
  DocumentCenterStatus,
  DocumentSortOption,
} from '../types/documentCenter';

// ─── Store Interface ────────────────────────────────────────────────────────

interface DocumentCenterState {
  // UI State (persisted)
  filters: DocumentCenterFilters;
  selectedDocumentId: string | null;

  // Actions
  setCategory: (category: DocumentCategory) => void;
  setStatus: (status: DocumentCenterStatus | 'all') => void;
  setSearch: (search: string) => void;
  setSort: (sort: DocumentSortOption) => void;
  setAgentFilter: (agentId: string | null) => void;
  selectDocument: (id: string | null) => void;
  resetFilters: () => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const INITIAL_FILTERS: DocumentCenterFilters = {
  category: 'all',
  status: 'all',
  search: '',
  sort: 'newest',
  agentId: null,
};

// ─── Store ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'agora-document-center-v1';

export const useDocumentCenterStore = create<DocumentCenterState>()(
  persist(
    (set) => ({
      filters: INITIAL_FILTERS,
      selectedDocumentId: null,

      setCategory: (category) =>
        set((s) => ({ filters: { ...s.filters, category } })),
      setStatus: (status) =>
        set((s) => ({ filters: { ...s.filters, status } })),
      setSearch: (search) =>
        set((s) => ({ filters: { ...s.filters, search } })),
      setSort: (sort) =>
        set((s) => ({ filters: { ...s.filters, sort } })),
      setAgentFilter: (agentId) =>
        set((s) => ({ filters: { ...s.filters, agentId } })),
      selectDocument: (id) => set({ selectedDocumentId: id }),
      resetFilters: () => set({ filters: INITIAL_FILTERS }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filters: state.filters,
        selectedDocumentId: state.selectedDocumentId,
      }),
    }
  )
);
