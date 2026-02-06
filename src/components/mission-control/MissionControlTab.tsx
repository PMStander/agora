import { useEffect } from 'react';
import { KanbanBoard } from './KanbanBoard';
import { CreateTaskModal } from './CreateTaskModal';
import { ActivityFeed } from './ActivityFeed';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore } from '../../stores/missionControl';

export function MissionControlTab() {
  const { isConfigured } = useMissionControl();
  const { setCreateModalOpen, filter, setFilter } = useMissionControlStore();

  // Initialize mission control on mount
  useEffect(() => {
    if (!isConfigured) {
      console.warn('[MissionControl] Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
    }
  }, [isConfigured]);

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-6xl mb-4">🏛️</div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">
          Mission Control Setup Required
        </h2>
        <p className="text-zinc-400 max-w-md mb-6">
          Connect to Supabase to enable the task management system.
          Add your credentials to the environment variables.
        </p>
        <div className="bg-zinc-800 rounded-lg p-4 text-left text-sm font-mono">
          <p className="text-zinc-500"># Add to .env file:</p>
          <p className="text-amber-400">VITE_SUPABASE_URL=your-project-url</p>
          <p className="text-amber-400">VITE_SUPABASE_ANON_KEY=your-anon-key</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-zinc-100">Mission Control</h1>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filter.team}
              onChange={(e) => setFilter({ team: e.target.value as any })}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
            >
              <option value="all">All Teams</option>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
        >
          <span>+</span>
          <span>New Task</span>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Kanban board */}
        <div className="flex-1 overflow-hidden py-4">
          <KanbanBoard />
        </div>

        {/* Activity sidebar */}
        <div className="w-72 border-l border-zinc-800 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-400">Activity</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ActivityFeed limit={20} />
          </div>
        </div>
      </div>

      {/* Create task modal */}
      <CreateTaskModal />
    </div>
  );
}
