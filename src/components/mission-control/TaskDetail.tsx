import { useEffect, useMemo, useState } from 'react';
import { useSelectedTask, useMissionControlStore, useMissionLogs } from '../../stores/missionControl';
import { useMissionControl } from '../../hooks/useMissionControl';
import { getIncompleteDependencyTitles, isRootMissionPlaceholder } from '../../lib/taskDependencies';
import { assessMissionProof } from '../../lib/missionProof';
import type { Comment, MissionLog, TaskStatus, TaskPriority } from '../../types/supabase';
import { TASK_COLUMNS } from '../../types/supabase';

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: '🔥 Urgent' },
];

function toDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) return iso;
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCompletionSummary(completedAt: string | null): string {
  if (!completedAt) return 'Not completed yet.';
  const value = Date.parse(completedAt);
  if (!Number.isFinite(value)) return `Completed at ${completedAt}`;

  const elapsedMs = Date.now() - value;
  const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60_000));
  if (elapsedMinutes < 60) {
    return `Completed ${elapsedMinutes}m ago (${formatDateTime(completedAt)})`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 48) {
    return `Completed ${elapsedHours}h ago (${formatDateTime(completedAt)})`;
  }
  const elapsedDays = Math.round(elapsedHours / 24);
  return `Completed ${elapsedDays}d ago (${formatDateTime(completedAt)})`;
}

type TaskDetailTab = 'live-stream' | 'output';

export function TaskDetail() {
  const task = useSelectedTask();
  const { agents, moveTask, assignTask, updateTaskDetails, addComment } = useMissionControl();
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const allTasks = useMissionControlStore((s) => s.tasks);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [detailTab, setDetailTab] = useState<TaskDetailTab>('live-stream');

  const taskMissionId = task ? (task.root_task_id || task.id) : null;
  const missionLogs = useMissionLogs(taskMissionId);

  useEffect(() => {
    if (!task) return;
    setComments([]);
  }, [task?.id]);

  useEffect(() => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    const parts = toDateTimeParts(task.due_at);
    setDueDate(parts.date);
    setDueTime(parts.time);
    setIsEditing(false);
  }, [task?.id]);

  useEffect(() => {
    if (!task) return;
    setDetailTab(task.status === 'done' ? 'output' : 'live-stream');
  }, [task?.id]);

  useEffect(() => {
    if (!task) return;
    if (task.status === 'done') setDetailTab('output');
    if (task.status === 'in_progress') setDetailTab('live-stream');
  }, [task?.status]);

  const dependencyCandidates = useMemo(() => {
    if (!task) return [];
    const missionRootId = task.root_task_id || task.id;
    return allTasks.filter((entry) => {
      return entry.id !== task.id
        && (entry.root_task_id || entry.id) === missionRootId
        && !isRootMissionPlaceholder(entry, allTasks);
    });
  }, [allTasks, task]);

  const unmetDependencies = useMemo(() => {
    if (!task) return [];
    return getIncompleteDependencyTitles(task, allTasks);
  }, [allTasks, task]);

  const timelineLogs = useMemo(() => {
    if (!task) return [] as MissionLog[];
    const taskIds = new Set<string>([task.id, task.root_task_id || task.id]);
    return missionLogs.filter((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      if (!metadata || typeof metadata !== 'object') return true;
      const metadataTaskId = typeof metadata.task_id === 'string'
        ? metadata.task_id
        : typeof metadata.taskId === 'string'
        ? metadata.taskId
        : null;
      if (!metadataTaskId) return true;
      return taskIds.has(metadataTaskId);
    });
  }, [missionLogs, task]);

  const completionSummary = useMemo(() => {
    return formatCompletionSummary(task?.completed_at ?? null);
  }, [task?.completed_at]);

  const proof = useMemo(() => {
    if (!task) return null;
    const missionStatus = task.status === 'done'
      ? 'done'
      : task.status === 'failed'
      ? 'failed'
      : 'in_progress';
    return assessMissionProof({
      title: task.title,
      description: task.description,
      input_text: task.input_text,
      output_text: task.output_text,
      mission_status: missionStatus,
      status: missionStatus,
    });
  }, [task]);

  const agentLabelById = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((agent: { id: string; name: string; emoji: string }) => {
      map.set(agent.id, `${agent.emoji} ${agent.name}`);
    });
    return map;
  }, [agents]);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-zinc-500">Select a mission to view details</p>
      </div>
    );
  }

  const handleSaveEdit = async () => {
    await updateTaskDetails(task.id, {
      title: editTitle,
      description: editDescription,
      input_text: editDescription,
    });
    setIsEditing(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await addComment(task.id, newComment);
    setNewComment('');
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    await moveTask(task.id, newStatus);
  };

  const handleAssigneeToggle = async (agentId: string) => {
    const currentIds = task.assignees?.map((a) => a.id) || [];
    const newIds = currentIds.includes(agentId)
      ? currentIds.filter((id) => id !== agentId)
      : [...currentIds, agentId];
    await assignTask(task.id, newIds);
  };

  const handleDueSave = async () => {
    const dueAt = new Date(`${dueDate}T${dueTime}`).toISOString();
    await updateTaskDetails(task.id, { due_at: dueAt });
  };

  const handleDependencyToggle = async (dependencyTaskId: string) => {
    const current = task.dependency_task_ids || [];
    const next = current.includes(dependencyTaskId)
      ? current.filter((id) => id !== dependencyTaskId)
      : [...current, dependencyTaskId];
    await updateTaskDetails(task.id, { dependency_task_ids: next });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Mission Task Details</h2>
        <button
          onClick={() => selectTask(null)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Status</label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
          >
            {TASK_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>{col.title}</option>
            ))}
          </select>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 text-xs bg-amber-500 text-black rounded"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 text-xs text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div onClick={() => setIsEditing(true)} className="cursor-pointer">
            <h3 className="text-lg font-medium text-zinc-100 mb-2">{task.title}</h3>
            <p className="text-sm text-zinc-400 whitespace-pre-wrap">
              {task.description || 'Click to add description...'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Priority</label>
            <select
              value={task.priority}
              onChange={(e) => updateTaskDetails(task.id, { priority: e.target.value as TaskPriority })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Primary Agent</label>
            <select
              value={task.primary_agent_id}
              onChange={(e) => updateTaskDetails(task.id, { primary_agent_id: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
            >
              {agents.map((agent: { id: string; name: string; emoji: string }) => (
                <option key={agent.id} value={agent.id}>
                  {agent.emoji} {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Due Time</label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
            />
          </div>
        </div>
        <button
          onClick={handleDueSave}
          className="px-3 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:border-zinc-500"
        >
          Save Due Time
        </button>

        <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Review Loop</span>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={task.review_enabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  const fallbackReviewer = agents.find((agent: { id: string }) => agent.id !== task.primary_agent_id)?.id ?? null;
                  updateTaskDetails(task.id, {
                    review_enabled: enabled,
                    review_agent_id: enabled ? (task.review_agent_id || fallbackReviewer) : null,
                    max_revisions: enabled ? task.max_revisions : 0,
                  });
                }}
                className="accent-amber-500"
              />
              Enabled
            </label>
          </div>
          {task.review_enabled && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Review Agent</label>
                <select
                  value={task.review_agent_id || ''}
                  onChange={(e) => updateTaskDetails(task.id, { review_agent_id: e.target.value || null })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
                >
                  {agents
                    .filter((agent: { id: string }) => agent.id !== task.primary_agent_id)
                    .map((agent: { id: string; name: string; emoji: string }) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.emoji} {agent.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Max Revisions</label>
                <select
                  value={task.max_revisions}
                  onChange={(e) => updateTaskDetails(task.id, { max_revisions: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
                >
                  <option value={0}>No limit</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                </select>
              </div>
            </div>
          )}
          <div className="text-xs text-zinc-500">
            Current revision: {task.max_revisions > 0 ? `${task.revision_round}/${task.max_revisions}` : `${task.revision_round} (no limit)`}
          </div>
        </div>

        <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Dependencies</span>
            <span className="text-xs text-zinc-400">{task.dependency_task_ids.length}</span>
          </div>
          {dependencyCandidates.length === 0 && (
            <div className="text-xs text-zinc-600">No missions available to depend on.</div>
          )}
          {dependencyCandidates.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {dependencyCandidates.map((candidate) => {
                const checked = task.dependency_task_ids.includes(candidate.id);
                return (
                  <label
                    key={candidate.id}
                    className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleDependencyToggle(candidate.id)}
                      className="accent-amber-500"
                    />
                    <span className="truncate">{candidate.title}</span>
                    <span className="ml-auto text-zinc-500">{candidate.status}</span>
                  </label>
                );
              })}
            </div>
          )}
          {unmetDependencies.length > 0 && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">
              Waiting on: {unmetDependencies.join(', ')}
            </div>
          )}
        </div>

        {task.input_media.length > 0 && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Attached Media</label>
            <div className="space-y-1">
              {task.input_media.map((media, index) => (
                <div key={`${media.name}-${index}`} className="text-xs text-zinc-300 bg-zinc-800 rounded px-2 py-1">
                  {media.name} ({media.type})
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">Execution Details</div>
            <span className="text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5">
              {task.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded border border-zinc-700 bg-zinc-900 p-1">
            <button
              onClick={() => setDetailTab('live-stream')}
              className={`
                rounded px-2 py-1.5 text-xs font-medium transition-colors
                ${detailTab === 'live-stream'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-zinc-400 hover:text-zinc-200'
                }
              `}
            >
              Live Stream
            </button>
            <button
              onClick={() => setDetailTab('output')}
              className={`
                rounded px-2 py-1.5 text-xs font-medium transition-colors
                ${detailTab === 'output'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-zinc-400 hover:text-zinc-200'
                }
              `}
            >
              Output
            </button>
          </div>

          {detailTab === 'live-stream' ? (
            <div className="space-y-2">
              <div className="text-xs text-zinc-300">
                {task.active_summary || (task.status === 'done' ? 'Mission completed.' : task.status === 'failed' ? 'Mission failed.' : 'Waiting to start.')}
              </div>
              {task.active_phase && (
                <div className="text-xs text-zinc-500">
                  Phase: {task.active_phase === 'primary' ? 'Primary execution' : 'AI review'}
                </div>
              )}
              {task.active_thinking ? (
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-200 bg-zinc-950/60 border border-zinc-800 rounded p-2">
                  {task.active_thinking}
                </pre>
              ) : (
                <div className="text-xs text-zinc-500 border border-zinc-800 rounded p-2 bg-zinc-900/60">
                  {task.status === 'in_progress'
                    ? 'Streaming output will appear here while the mission runs.'
                    : 'No live thinking stream available.'}
                </div>
              )}

              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Mission Logs</span>
                  <span className="text-[11px] text-zinc-600">{timelineLogs.length} events</span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {timelineLogs.length === 0 && (
                    <div className="text-xs text-zinc-600">No mission logs yet for this mission.</div>
                  )}
                  {timelineLogs.map((log) => {
                    const agentName = log.agent_id
                      ? (agentLabelById.get(log.agent_id) || log.agent_id)
                      : 'System';
                    return (
                      <div key={log.id} className="rounded border border-zinc-800 bg-zinc-900/70 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400 truncate">{log.type}</span>
                          <span className="text-[10px] text-zinc-600">{formatDateTime(log.created_at)}</span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-300 whitespace-pre-wrap">{log.message}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">{agentName}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-zinc-300">{completionSummary}</div>
              {proof && (
                <div
                  className={`
                    text-xs border rounded p-2
                    ${proof.state === 'verified'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : proof.state === 'not_required'
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }
                  `}
                >
                  <div className="font-medium">{proof.label}</div>
                  <div className="mt-1 whitespace-pre-wrap">{proof.detail}</div>
                  {proof.report && proof.report.changed_files.length > 0 && (
                    <div className="mt-2 text-[11px]">
                      Files: {proof.report.changed_files.map((file) => file.path).join(', ')}
                    </div>
                  )}
                </div>
              )}
              {task.output_text ? (
                <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-200 bg-zinc-950/60 border border-zinc-800 rounded p-2">
                  {task.output_text}
                </pre>
              ) : (
                <div className="text-xs text-zinc-500 border border-zinc-800 rounded p-2 bg-zinc-900/60">
                  {task.status === 'in_progress'
                    ? 'Output will appear after completion.'
                    : 'No output recorded.'}
                </div>
              )}
              {task.review_notes ? (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2 whitespace-pre-wrap">
                  {task.review_notes}
                </div>
              ) : (
                <div className="text-xs text-zinc-500">No review notes.</div>
              )}
            </div>
          )}

          {task.error_message && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2">
              {task.error_message}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-zinc-500 mb-2">Assigned To</label>
          <div className="flex flex-wrap gap-2">
            {agents.map((agent: { id: string; name: string; emoji: string; role?: string }) => {
              const isAssigned = task.assignees?.some((a) => a.id === agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => handleAssigneeToggle(agent.id)}
                  title={agent.role}
                  className={`
                    px-2 py-1 text-xs rounded-full border transition-colors flex items-center gap-1
                    ${isAssigned
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                    }
                  `}
                >
                  <span>{agent.emoji}</span>
                  {agent.name}
                </button>
              );
            })}
          </div>
        </div>

        {task.domains && task.domains.length > 0 && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Domains</label>
            <div className="flex flex-wrap gap-1">
              {task.domains.map((domain) => (
                <span
                  key={domain}
                  className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-zinc-800">
          <label className="block text-xs text-zinc-500 mb-2">
            Comments ({comments.length})
          </label>
          
          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-300">
                    {comment.author.name}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{comment.content}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-sm text-zinc-600 text-center py-4">No comments yet</p>
            )}
          </div>

          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-3 py-1.5 bg-amber-500 text-black text-sm rounded disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
