import { useNotificationsStore } from '../../stores/notifications';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

export function NotificationDrawer() {
  const { notifications, drawerOpen } = useNotificationsStore();
  const { markAsRead, markAllAsRead } = useNotifications();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const setDrawerOpen = useNotificationsStore((s) => s.setDrawerOpen);

  if (!drawerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel */}
      <div className="absolute top-full right-0 z-50 w-96 max-h-[70vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col mt-1">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-xs text-zinc-500">
                {unreadCount} unread
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
