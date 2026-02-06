import { create } from 'zustand';
import type { Task, Agent, Activity, TaskStatus } from '../types/supabase';

interface MissionControlState {
  // Data
  tasks: Task[];
  agents: Agent[];
  activities: Activity[];
  
  // UI State
  selectedTaskId: string | null;
  isCreateModalOpen: boolean;
  activeTab: 'chat' | 'mission-control';
  filter: {
    team: 'all' | 'personal' | 'business';
    assignee: string | null;
    status: TaskStatus | 'all';
  };
  
  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  
  setActivities: (activities: Activity[]) => void;
  addActivity: (activity: Activity) => void;
  
  selectTask: (taskId: string | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  setActiveTab: (tab: 'chat' | 'mission-control') => void;
  setFilter: (filter: Partial<MissionControlState['filter']>) => void;
}

export const useMissionControlStore = create<MissionControlState>((set) => ({
  // Initial data
  tasks: [],
  agents: [],
  activities: [],
  
  // Initial UI state
  selectedTaskId: null,
  isCreateModalOpen: false,
  activeTab: 'chat',
  filter: {
    team: 'all',
    assignee: null,
    status: 'all',
  },
  
  // Task actions
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
  })),
  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== taskId),
    selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
  })),
  
  // Agent actions
  setAgents: (agents) => set({ agents }),
  updateAgent: (agentId, updates) => set((state) => ({
    agents: state.agents.map((a) => (a.id === agentId ? { ...a, ...updates } : a)),
  })),
  
  // Activity actions
  setActivities: (activities) => set({ activities }),
  addActivity: (activity) => set((state) => ({
    activities: [activity, ...state.activities].slice(0, 100), // Keep last 100
  })),
  
  // UI actions
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter } })),
}));

// Selectors
export const useSelectedTask = () => {
  const tasks = useMissionControlStore((s) => s.tasks);
  const selectedTaskId = useMissionControlStore((s) => s.selectedTaskId);
  return tasks.find((t) => t.id === selectedTaskId) || null;
};

export const useFilteredTasks = () => {
  const tasks = useMissionControlStore((s) => s.tasks);
  const filter = useMissionControlStore((s) => s.filter);
  
  return tasks.filter((task) => {
    if (filter.team !== 'all' && task.team !== filter.team) return false;
    if (filter.status !== 'all' && task.status !== filter.status) return false;
    if (filter.assignee && !task.assignees?.some((a) => a.id === filter.assignee)) return false;
    return true;
  });
};

export const useTasksByStatus = (status: TaskStatus) => {
  const filteredTasks = useFilteredTasks();
  return filteredTasks.filter((t) => t.status === status);
};

export const useAgentById = (agentId: string | null) => {
  const agents = useMissionControlStore((s) => s.agents);
  return agents.find((a) => a.id === agentId) || null;
};

export const useAgentsByTeam = (team: 'personal' | 'business') => {
  const agents = useMissionControlStore((s) => s.agents);
  return agents.filter((a) => a.team === team);
};
