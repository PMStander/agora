import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  owner_agent_id: string | null;
  budget: number | null;
  currency: string;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Client-side enrichment
  mission_ids?: string[];
}

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'zinc' },
  active: { label: 'Active', color: 'blue' },
  on_hold: { label: 'On Hold', color: 'amber' },
  completed: { label: 'Completed', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
};

// ─── Store Interface ────────────────────────────────────────────────────────

interface ProjectsState {
  // Data (loaded from Supabase)
  projects: Project[];

  // UI State (persisted)
  selectedProjectId: string | null;
  activeSubTab: 'active' | 'archive';
  searchQuery: string;
  filters: {
    status: ProjectStatus | 'all';
    ownerAgent: string | null;
  };

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  removeProject: (projectId: string) => void;

  // UI Actions
  selectProject: (id: string | null) => void;
  setActiveSubTab: (tab: ProjectsState['activeSubTab']) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<ProjectsState['filters']>) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const PROJECTS_STORAGE_KEY = 'agora-projects-v1';

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],
      selectedProjectId: null,
      activeSubTab: 'active',
      searchQuery: '',
      filters: { status: 'all', ownerAgent: null },

      setProjects: (projects) => set({ projects }),
      addProject: (project) =>
        set((state) => {
          const idx = state.projects.findIndex((p) => p.id === project.id);
          if (idx === -1) return { projects: [project, ...state.projects] };
          const projects = [...state.projects];
          projects[idx] = { ...projects[idx], ...project };
          return { projects };
        }),
      updateProject: (projectId, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
        })),
      removeProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          selectedProjectId:
            state.selectedProjectId === projectId ? null : state.selectedProjectId,
        })),

      selectProject: (id) => set({ selectedProjectId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
    }),
    {
      name: PROJECTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedProjectId: state.selectedProjectId,
        activeSubTab: state.activeSubTab,
        filters: state.filters,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedProject = () => {
  const projects = useProjectsStore((s) => s.projects);
  const selectedId = useProjectsStore((s) => s.selectedProjectId);
  return projects.find((p) => p.id === selectedId) || null;
};

export const useFilteredProjects = () => {
  const projects = useProjectsStore((s) => s.projects);
  const searchQuery = useProjectsStore((s) => s.searchQuery);
  const filters = useProjectsStore((s) => s.filters);
  const activeSubTab = useProjectsStore((s) => s.activeSubTab);

  return projects.filter((project) => {
    // Tab filter
    if (activeSubTab === 'active') {
      if (project.status === 'completed' || project.status === 'cancelled') return false;
    } else {
      if (project.status !== 'completed' && project.status !== 'cancelled') return false;
    }

    if (filters.status !== 'all' && project.status !== filters.status) return false;
    if (filters.ownerAgent && project.owner_agent_id !== filters.ownerAgent) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        project.name.toLowerCase().includes(q) ||
        (project.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });
};
