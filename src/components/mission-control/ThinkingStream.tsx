import { useMemo } from 'react';
import { useMissionControlStore } from '../../stores/missionControl';
import { AGENTS } from '../../types/supabase';

interface ThinkingEntry {
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  phase: 'primary' | 'review';
  thinking: string;
  timestamp: string;
}

function useThinkingEntries(): ThinkingEntry[] {
  const tasks = useMissionControlStore((s) => s.tasks);

  return useMemo(() => {
    const entries: ThinkingEntry[] = [];

    for (const task of tasks) {
      // Only show tasks that are currently running with thinking
      if (!task.active_thinking || !task.active_phase) continue;
      if (task.status !== 'in_progress' && task.status !== 'review') continue;

      const agent = AGENTS.find((a) => a.id === task.primary_agent_id);

      entries.push({
        taskId: task.id,
        taskTitle: task.title,
        agentId: task.primary_agent_id,
        agentName: agent?.name || task.primary_agent_id,
        agentEmoji: agent?.emoji || '🤖',
        phase: task.active_phase,
        thinking: task.active_thinking,
        timestamp: task.updated_at,
      });
    }

    // Sort by most recent update first
    return entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [tasks]);
}

function formatThinkingPreview(thinking: string): string {
  // Get the last 200 characters (most recent reasoning)
  const recent = thinking.slice(-200);
  // Clean up any trailing partial word
  const clean = recent.replace(/^[^\s]*\s*/, '');
  return clean || thinking.slice(0, 100);
}

export function ThinkingStream() {
  const entries = useThinkingEntries();

  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-zinc-600">No active agent thinking</p>
        <p className="text-[10px] text-zinc-700 mt-1">
          Agents will show their reasoning here when running
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {entries.map((entry) => (
        <div
          key={entry.taskId}
          className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-2.5"
        >
          {/* Header: Agent + Task */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">{entry.agentEmoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 truncate font-medium">
                {entry.agentName}
              </p>
              <p className="text-[10px] text-zinc-600 truncate">
                {entry.taskTitle}
              </p>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                entry.phase === 'primary'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              {entry.phase === 'primary' ? 'Thinking' : 'Reviewing'}
            </span>
          </div>

          {/* Thinking content - last 200 chars */}
          <div className="bg-zinc-950/60 rounded border border-zinc-800/50 p-2">
            <p className="text-[10px] text-zinc-400 font-mono leading-relaxed line-clamp-4">
              {formatThinkingPreview(entry.thinking)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
