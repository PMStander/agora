import { cn } from '../../lib/utils';
import type { Notification } from '../../types/notifications';
import { NOTIFICATION_TYPE_CONFIG } from '../../types/notifications';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const typeConfig = NOTIFICATION_TYPE_CONFIG[notification.type];

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id);
    }
    onClick?.(notification);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-3 py-2.5 border-b border-zinc-800 transition-colors hover:bg-zinc-800/50',
        !notification.is_read && 'bg-zinc-800/30'
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Severity indicator dot */}
        <div className="flex-shrink-0 mt-1.5">
          {!notification.is_read ? (
            <span
              className={cn(
                'block w-2 h-2 rounded-full',
                notification.severity === 'success' && 'bg-green-500',
                notification.severity === 'error' && 'bg-red-500',
                notification.severity === 'warning' && 'bg-amber-500',
                notification.severity === 'info' && 'bg-blue-500'
              )}
            />
          ) : (
            <span className="block w-2 h-2" />
          )}
        </div>

        {/* Icon */}
        <span className="text-sm flex-shrink-0 mt-0.5">{typeConfig.icon}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'text-sm font-medium truncate',
                notification.is_read ? 'text-zinc-400' : 'text-zinc-200'
              )}
            >
              {notification.title}
            </span>
            <span className="text-xs text-zinc-500 flex-shrink-0">
              {timeAgo(notification.created_at)}
            </span>
          </div>
          {notification.body && (
            <p
              className={cn(
                'text-xs mt-0.5 line-clamp-2',
                notification.is_read ? 'text-zinc-500' : 'text-zinc-400'
              )}
            >
              {notification.body}
            </p>
          )}
          {notification.agent_id && (
            <span className="text-xs text-zinc-600 mt-0.5 block">
              by {notification.agent_id}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
