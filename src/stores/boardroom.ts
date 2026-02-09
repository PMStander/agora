import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BoardroomSession, BoardroomMessage } from '../types/boardroom';

// ─── Store Interface ────────────────────────────────────────────────────────

interface BoardroomState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  sessions: BoardroomSession[];
  messages: Record<string, BoardroomMessage[]>; // keyed by session ID

  // Orchestration (not persisted)
  activeSessionId: string | null;
  currentSpeakingAgentId: string | null;
  isOrchestrating: boolean;
  streamingContent: string;

  // UI State (persisted)
  selectedSessionId: string | null;
  activeView: 'meet-the-team' | 'boardroom';
  isCreateSessionModalOpen: boolean;

  // ─── Session Actions ──────────────────────────────────────
  setSessions: (sessions: BoardroomSession[]) => void;
  addSession: (session: BoardroomSession) => void;
  updateSession: (sessionId: string, updates: Partial<BoardroomSession>) => void;
  removeSession: (sessionId: string) => void;

  // ─── Message Actions ──────────────────────────────────────
  setMessagesForSession: (sessionId: string, messages: BoardroomMessage[]) => void;
  addMessage: (message: BoardroomMessage) => void;

  // ─── Orchestration Actions ────────────────────────────────
  setActiveSessionId: (id: string | null) => void;
  setCurrentSpeakingAgentId: (id: string | null) => void;
  setIsOrchestrating: (val: boolean) => void;
  setStreamingContent: (content: string) => void;

  // ─── UI Actions ───────────────────────────────────────────
  setSelectedSessionId: (id: string | null) => void;
  setActiveView: (view: BoardroomState['activeView']) => void;
  setCreateSessionModalOpen: (open: boolean) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const BOARDROOM_STORAGE_KEY = 'agora-boardroom-v1';

export const useBoardroomStore = create<BoardroomState>()(
  persist(
    (set) => ({
      // Initial data
      sessions: [],
      messages: {},

      // Orchestration
      activeSessionId: null,
      currentSpeakingAgentId: null,
      isOrchestrating: false,
      streamingContent: '',

      // UI State
      selectedSessionId: null,
      activeView: 'meet-the-team',
      isCreateSessionModalOpen: false,

      // Session Actions (upsert pattern)
      setSessions: (sessions) => set({ sessions }),
      addSession: (session) =>
        set((state) => {
          const idx = state.sessions.findIndex((s) => s.id === session.id);
          if (idx === -1) return { sessions: [session, ...state.sessions] };
          const sessions = [...state.sessions];
          sessions[idx] = { ...sessions[idx], ...session };
          return { sessions };
        }),
      updateSession: (sessionId, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, ...updates } : s
          ),
        })),
      removeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          selectedSessionId:
            state.selectedSessionId === sessionId ? null : state.selectedSessionId,
          activeSessionId:
            state.activeSessionId === sessionId ? null : state.activeSessionId,
        })),

      // Message Actions
      setMessagesForSession: (sessionId, messages) =>
        set((state) => ({
          messages: { ...state.messages, [sessionId]: messages },
        })),
      addMessage: (message) =>
        set((state) => {
          const existing = state.messages[message.session_id] || [];
          // Upsert by id
          const idx = existing.findIndex((m) => m.id === message.id);
          if (idx === -1) {
            return {
              messages: {
                ...state.messages,
                [message.session_id]: [...existing, message],
              },
            };
          }
          const updated = [...existing];
          updated[idx] = { ...updated[idx], ...message };
          return {
            messages: { ...state.messages, [message.session_id]: updated },
          };
        }),

      // Orchestration Actions
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setCurrentSpeakingAgentId: (id) => set({ currentSpeakingAgentId: id }),
      setIsOrchestrating: (val) => set({ isOrchestrating: val }),
      setStreamingContent: (content) => set({ streamingContent: content }),

      // UI Actions
      setSelectedSessionId: (id) => set({ selectedSessionId: id }),
      setActiveView: (view) => set({ activeView: view }),
      setCreateSessionModalOpen: (open) => set({ isCreateSessionModalOpen: open }),
    }),
    {
      name: BOARDROOM_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state, NOT entity data
      partialize: (state) => ({
        selectedSessionId: state.selectedSessionId,
        activeView: state.activeView,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedSession = () => {
  const sessions = useBoardroomStore((s) => s.sessions);
  const selectedId = useBoardroomStore((s) => s.selectedSessionId);
  return sessions.find((s) => s.id === selectedId) || null;
};

export const useSessionMessages = (sessionId: string | null) => {
  const messages = useBoardroomStore((s) => s.messages);
  if (!sessionId) return [];
  return (messages[sessionId] || []).sort((a, b) => a.turn_number - b.turn_number);
};
