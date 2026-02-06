import { useMissionControlStore } from '../../stores/missionControl';
import type { Activity } from '../../types/supabase';

interface ActivityFeedProps {
  limit?: number;
}

const activityIcons: Record<string, string> = {
  task_created: '📝',
  task_moved: '➡️',
  comment_added: '💬',
  agent_assigned: '👤',
  task_completed: '✅',
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function ActivityItem({ activity }: { activity: Activity }) {
  const icon = activityIcons[activity.type] || '📌';
  
  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-zinc-800/50 rounded-lg transition-colors">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 truncate">
          {activity.message}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {activity.agent && (
            <span className="text-xs text-zinc-500">
              {activity.agent.name}
            </span>
          )}
          <span className="text-xs text-zinc-600">
            {formatTime(activity.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
  const activities = useMissionControlStore((s) => s.activities);
  const displayedActivities = activities.slice(0, limit);

  if (displayedActivities.length === 0) {
    return (
      <div className="text-center text-zinc-600 py-8">
        <p className="text-sm">No activity yet</p>
        <p className="text-xs mt-1">Create a task to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {displayedActivities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
