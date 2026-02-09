import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNotificationsStore } from '../stores/notifications';
import type {
  Notification,
  NotificationType,
  NotificationSeverity,
  NotificationLinkType,
} from '../types/notifications';
import { NOTIFICATION_TYPE_CONFIG } from '../types/notifications';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useNotifications() {
  const store = useNotificationsStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscription ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch recent notifications
    supabase
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!error && data) {
          store.setNotifications(data as Notification[]);
        }
      });

    // Realtime subscription for new notifications
    const sub = supabase
      .channel('app-notifications-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_notifications' },
        (payload) => {
          store.addNotification(payload.new as Notification);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_notifications' },
        (payload) => {
          const updated = payload.new as Notification;
          // Just update in place via addNotification (upsert)
          store.addNotification(updated);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'app_notifications' },
        (payload) => {
          if (payload.old?.id) store.removeNotification(payload.old.id as string);
        }
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mark as read ──
  const markAsRead = useCallback(async (notificationId: string) => {
    store.markAsRead(notificationId);
    await supabase
      .from('app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
  }, [store]);

  // ── Mark all as read ──
  const markAllAsRead = useCallback(async () => {
    const unreadIds = store.notifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;

    store.markAllAsRead();
    await supabase
      .from('app_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);
  }, [store]);

  // ── Create notification ──
  const createNotification = useCallback(
    async (
      type: NotificationType,
      title: string,
      body?: string,
      linkType?: NotificationLinkType,
      linkId?: string,
      agentId?: string,
      severity?: NotificationSeverity,
      metadata?: Record<string, unknown>
    ) => {
      const config = NOTIFICATION_TYPE_CONFIG[type];
      const { data, error } = await supabase
        .from('app_notifications')
        .insert({
          type,
          title,
          body: body || null,
          severity: severity || config.defaultSeverity,
          link_type: linkType || null,
          link_id: linkId || null,
          agent_id: agentId || null,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('[Notifications] Error creating notification:', error);
        return null;
      }
      return data as Notification;
    },
    []
  );

  // ── Delete old notifications ──
  const deleteOldNotifications = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabase
      .from('app_notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());
  }, []);

  return {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    drawerOpen: store.drawerOpen,
    toastQueue: store.toastQueue,
    setDrawerOpen: store.setDrawerOpen,
    toggleDrawer: store.toggleDrawer,
    dismissToast: store.dismissToast,
    markAsRead,
    markAllAsRead,
    createNotification,
    deleteOldNotifications,
    isConfigured: isSupabaseConfigured(),
  };
}

// ─── Standalone helper for creating notifications outside React ──────────

export async function createNotificationDirect(
  type: NotificationType,
  title: string,
  body?: string,
  linkType?: NotificationLinkType,
  linkId?: string,
  agentId?: string,
  severity?: NotificationSeverity,
  metadata?: Record<string, unknown>
) {
  const config = NOTIFICATION_TYPE_CONFIG[type];
  const { data, error } = await supabase
    .from('app_notifications')
    .insert({
      type,
      title,
      body: body || null,
      severity: severity || config.defaultSeverity,
      link_type: linkType || null,
      link_id: linkId || null,
      agent_id: agentId || null,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[Notifications] Error creating notification:', error);
    return null;
  }
  return data as Notification;
}
