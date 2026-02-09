import { useEffect, useCallback } from 'react';
import { useNotificationsStore } from '../../stores/notifications';
import { NOTIFICATION_TYPE_CONFIG } from '../../types/notifications';
import { cn } from '../../lib/utils';
import type { Notification } from '../../types/notifications';

function ToastItem({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
}) {
  const typeConfig = NOTIFICATION_TYPE_CONFIG[notification.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div
      className={cn(
        'flex items-start gap-3 w-80 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-right fade-in duration-300',
        'bg-zinc-900 border-zinc-700'
      )}
    >
      <span className="text-base flex-shrink-0">{typeConfig.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function NotificationToast() {
  const toastQueue = useNotificationsStore((s) => s.toastQueue);
  const dismissToast = useNotificationsStore((s) => s.dismissToast);

  const handleDismiss = useCallback(
    (id: string) => {
      dismissToast(id);
    },
    [dismissToast]
  );

  if (toastQueue.length === 0) return null;

  // Show up to 3 toasts at a time
  const visibleToasts = toastQueue.slice(0, 3);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
      {visibleToasts.map((notification) => (
        <ToastItem
          key={notification.id}
          notification={notification}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
