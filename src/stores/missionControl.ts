import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Mission, MissionLog, MissionStatus, TeamType, Task, Activity, ConnectionQuality, RunCheckpoint } from '../types/supabase';
import { AGENTS } from '../types/supabase';

interface MissionControlState {
  // Data
  missions: Mission[];
  logs: MissionLog[];
  tasks: Task[];
  activities: Activity[];

  // Connection state
  connectionQuality: ConnectionQuality;
  connectionLostAt: number | null;
  reconnecting: boolean;
  runCheckpoints: Record<string, RunCheckpoint>;

  // Approval system state
  pendingApprovals: Array<{
    taskId: string;
    missionId: string;
    agentId: string;
    agentLevel: number;
    reason: string;
    requestedAt: string;
  }>;

  // UI State
  selectedMissionId: string | null;
  selectedTaskId: string | null;
  isCreateModalOpen: boolean;
  isOperationWizardOpen: boolean;
  activeTab: 'chat' | 'mission-control' | 'crm' | 'products' | 'projects' | 'reports' | 'reviews' | 'context' | 'automation' | 'invoicing' | 'calendar' | 'teams' | 'money' | 'documents';
  schedulerLastTickAt: string | null;
  schedulerNextTickAt: string | null;
  schedulerForceTickVersion: number;
  realtimeLastEvent: string | null;
  realtimeStatus: string | null;
  filter: {
    team: 'all' | TeamType;
    status: MissionStatus | 'all';
    agent: string | null;
  };

  // ─── Mission Actions ────────────────────────────────────
  setMissions: (missions: Mission[]) => void;
  addMission: (mission: Mission) => void;
  updateMission: (missionId: string, updates: Partial<Mission>) => void;
  removeMission: (missionId: string) => void;

  // ─── Log Actions ────────────────────────────────────────
  setLogs: (logs: MissionLog[]) => void;
  addLog: (log: MissionLog) => void;

  // ─── Task Actions ────────────────────────────────────────
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;

  // ─── Activity Actions ────────────────────────────────────
  setActivities: (activities: Activity[]) => void;
  addActivity: (activity: Activity) => void;

  // ─── Connection Actions ───────────────────────────────────
  setConnectionQuality: (quality: ConnectionQuality) => void;
  setConnectionLostAt: (timestamp: number | null) => void;
  setReconnecting: (reconnecting: boolean) => void;
  saveCheckpoint: (taskId: string, checkpoint: RunCheckpoint) => void;
  removeCheckpoint: (taskId: string) => void;
  clearAllCheckpoints: () => void;

  // ─── UI Actions ─────────────────────────────────────────
  selectMission: (missionId: string | null) => void;
  selectTask: (taskId: string | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  setOperationWizardOpen: (open: boolean) => void;
  setActiveTab: (tab: MissionControlState['activeTab']) => void;
  setSchedulerTick: (lastTickAt: string, nextTickAt: string) => void;
  requestSchedulerTick: () => void;
  setRealtimeLastEvent: (event: string | null) => void;
  setRealtimeStatus: (status: string | null) => void;
  setFilter: (filter: Partial<MissionControlState['filter']>) => void;

  // ─── Approval System Actions ──────────────────────────────
  requestApproval: (approval: {
    taskId: string;
    missionId: string;
    agentId: string;
    agentLevel: number;
    reason: string;
  }) => void;
  approveMission: (taskId: string) => void;
  rejectApproval: (taskId: string) => void;
}

const MISSION_CONTROL_STORAGE_KEY = 'agora-mission-control-v2';

export const useMissionControlStore = create<MissionControlState>()(persist((set) => ({
  // Initial data
  missions: [],
  logs: [],
  tasks: [],
  activities: [],

  // Connection state
  connectionQuality: 'good',
  connectionLostAt: null,
  reconnecting: false,
  runCheckpoints: {},

  // Approval system state
  pendingApprovals: [],

  // Initial UI state
  selectedMissionId: null,
  selectedTaskId: null,
  isCreateModalOpen: false,
  isOperationWizardOpen: false,
  activeTab: 'chat',
  schedulerLastTickAt: null,
  schedulerNextTickAt: null,
  schedulerForceTickVersion: 0,
  realtimeLastEvent: null,
  realtimeStatus: null,
  filter: {
    team: 'all',
    status: 'all',
    agent: null,
  },

  // Mission actions
  setMissions: (missions) => set({ missions }),
  addMission: (mission) =>
    set((state) => {
      const existingIndex = state.missions.findIndex((entry) => entry.id === mission.id);
      if (existingIndex === -1) {
        return { missions: [mission, ...state.missions] };
      }
      const missions = [...state.missions];
      missions[existingIndex] = { ...missions[existingIndex], ...mission };
      return { missions };
    }),
  updateMission: (missionId, updates) =>
    set((state) => ({
      missions: state.missions.map((m) =>
        m.id === missionId ? { ...m, ...updates } : m
      ),
    })),
  removeMission: (missionId) =>
    set((state) => ({
      missions: state.missions.filter((m) => m.id !== missionId),
      selectedMissionId:
        state.selectedMissionId === missionId ? null : state.selectedMissionId,
    })),

  // Log actions
  setLogs: (logs) => set({ logs }),
  addLog: (log) =>
    set((state) => {
      if (state.logs.some((entry) => entry.id === log.id)) return {};
      return { logs: [...state.logs, log].slice(-200) };
    }),

  // Task actions
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) =>
    set((state) => {
      const existingIndex = state.tasks.findIndex((entry) => entry.id === task.id);
      if (existingIndex === -1) {
        return { tasks: [task, ...state.tasks] };
      }
      const tasks = [...state.tasks];
      tasks[existingIndex] = { ...tasks[existingIndex], ...task };
      return { tasks };
    }),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      ),
    })),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      selectedTaskId:
        state.selectedTaskId === taskId ? null : state.selectedTaskId,
    })),

  // Activity actions
  setActivities: (activities) => set({ activities }),
  addActivity: (activity) =>
    set((state) => ({ activities: [activity, ...state.activities].slice(0, 200) })),

  // Connection actions
  setConnectionQuality: (quality) =>
    set((state) => ({
      connectionQuality: quality,
      connectionLostAt: quality === 'lost' && !state.connectionLostAt ? Date.now() : quality === 'good' ? null : state.connectionLostAt,
    })),
  setConnectionLostAt: (timestamp) => set({ connectionLostAt: timestamp }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  saveCheckpoint: (taskId, checkpoint) =>
    set((state) => ({
      runCheckpoints: { ...state.runCheckpoints, [taskId]: checkpoint },
    })),
  removeCheckpoint: (taskId) =>
    set((state) => {
      const { [taskId]: _, ...rest } = state.runCheckpoints;
      return { runCheckpoints: rest };
    }),
  clearAllCheckpoints: () => set({ runCheckpoints: {} }),

  // UI actions
  selectMission: (missionId) => set({ selectedMissionId: missionId }),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setOperationWizardOpen: (open) => set({ isOperationWizardOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSchedulerTick: (lastTickAt, nextTickAt) =>
    set({ schedulerLastTickAt: lastTickAt, schedulerNextTickAt: nextTickAt }),
  requestSchedulerTick: () =>
    set((state) => ({ schedulerForceTickVersion: state.schedulerForceTickVersion + 1 })),
  setRealtimeLastEvent: (event) => set({ realtimeLastEvent: event }),
  setRealtimeStatus: (status) => set({ realtimeStatus: status }),
  setFilter: (filter) =>
    set((state) => ({ filter: { ...state.filter, ...filter } })),

  // Approval system actions
  requestApproval: (approval: {
    taskId: string;
    missionId: string;
    agentId: string;
    agentLevel: number;
    reason: string;
  }) =>
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, { ...approval, requestedAt: new Date().toISOString() }],
    })),
  approveMission: (taskId: string) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((a) => a.taskId !== taskId),
    })),
  rejectApproval: (taskId: string) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((a) => a.taskId !== taskId),
    })),
}), {
  name: MISSION_CONTROL_STORAGE_KEY,
  storage: createJSONStorage(() => localStorage),
  // Supabase-first: only persist UI state, NOT entity data arrays
  // (missions, tasks, logs, activities, runCheckpoints are fetched from Supabase)
  partialize: (state) => ({
    selectedMissionId: state.selectedMissionId,
    selectedTaskId: state.selectedTaskId,
    activeTab: state.activeTab,
    filter: state.filter,
  }),
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedMission = () => {
  const missions = useMissionControlStore((s) => s.missions);
  const selectedMissionId = useMissionControlStore((s) => s.selectedMissionId);
  return missions.find((m) => m.id === selectedMissionId) || null;
};

export const useFilteredMissions = () => {
  const missions = useMissionControlStore((s) => s.missions);
  const filter = useMissionControlStore((s) => s.filter);

  return missions.filter((mission) => {
    // Team filter
    if (filter.team !== 'all') {
      const agentDef = AGENTS.find((a) => a.id === mission.agent_id);
      if (agentDef && agentDef.team !== filter.team) return false;
    }
    // Status filter
    if (filter.status !== 'all' && mission.status !== filter.status) return false;
    // Agent filter
    if (filter.agent && mission.agent_id !== filter.agent) return false;
    return true;
  });
};

export const useSelectedTask = () => {
  const tasks = useMissionControlStore((s) => s.tasks);
  const selectedTaskId = useMissionControlStore((s) => s.selectedTaskId);
  return tasks.find((t) => t.id === selectedTaskId) || null;
};

export const useFilteredTasks = () => {
  const tasks = useMissionControlStore((s) => s.tasks);
  const filter = useMissionControlStore((s) => s.filter);
  return tasks.filter((task) => {
    if (filter.team !== 'all') {
      const agentDef = AGENTS.find((a) => a.id === task.primary_agent_id);
      if (agentDef && agentDef.team !== filter.team) return false;
    }
    if (filter.agent && task.primary_agent_id !== filter.agent) return false;
    return true;
  });
};

export const useMissionsByStatus = (status: MissionStatus) => {
  const filteredMissions = useFilteredMissions();
  return filteredMissions.filter((m) => m.status === status);
};

export const useMissionLogs = (missionId: string | null) => {
  const logs = useMissionControlStore((s) => s.logs);
  if (!missionId) return [];
  return logs.filter((l) => l.mission_id === missionId);
};
