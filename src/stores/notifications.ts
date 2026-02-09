import { create } from 'zustand';
import type { Notification } from '../types/notifications';

// ─── Store Interface ────────────────────────────────────────────────────────

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  drawerOpen: boolean;

  // Toast queue
  toastQueue: Notification[];

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  dismissToast: (id: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  drawerOpen: false,
  toastQueue: [],

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    }),

  addNotification: (notification) =>
    set((state) => {
      const idx = state.notifications.findIndex((n) => n.id === notification.id);
      if (idx !== -1) {
        // Update existing
        const notifications = [...state.notifications];
        notifications[idx] = { ...notifications[idx], ...notification };
        return {
          notifications,
          unreadCount: notifications.filter((n) => !n.is_read).length,
        };
      }
      const notifications = [notification, ...state.notifications];
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.is_read).length,
        toastQueue: [notification, ...state.toastQueue],
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.is_read).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() }
      ),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.is_read).length,
      };
    }),

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

  dismissToast: (id) =>
    set((state) => ({
      toastQueue: state.toastQueue.filter((n) => n.id !== id),
    })),
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useUnreadNotifications = () =>
  useNotificationsStore((s) => s.notifications.filter((n) => !n.is_read));

export const useNotificationsByType = (type: string) =>
  useNotificationsStore((s) => s.notifications.filter((n) => n.type === type));
