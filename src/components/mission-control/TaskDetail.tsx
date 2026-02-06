import { useState, useEffect } from 'react';
import { useSelectedTask, useMissionControlStore } from '../../stores/missionControl';
import { useMissionControl } from '../../hooks/useMissionControl';
import { supabase, subscribeToComments, isSupabaseConfigured } from '../../lib/supabase';
import type { Comment, TaskStatus, TaskPriority } from '../../types/supabase';
import { TASK_COLUMNS } from '../../types/supabase';

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: '🔥 Urgent' },
];

export function TaskDetail() {
  const task = useSelectedTask();
  const { agents, moveTask, assignTask, updateTaskDetails, addComment } = useMissionControl();
  const selectTask = useMissionControlStore((s) => s.selectTask);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Fetch comments when task changes
  useEffect(() => {
    if (!task || !isSupabaseConfigured()) return;

    supabase
      .from('comments')
      .select(`*, agents (*)`)
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Error fetching comments:', error);
        else if (data) {
          setComments(data.map((c: any) => ({ ...c, agent: c.agents })));
        }
      });

    // Subscribe to new comments
    const subscription = subscribeToComments(task.id, (payload) => {
      if (payload.eventType === 'INSERT') {
        setComments((prev) => [...prev, payload.new]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [task?.id]);

  // Reset edit state when task changes
  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setIsEditing(false);
    }
  }, [task?.id]);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-zinc-500">Select a task to view details</p>
      </div>
    );
  }

  const handleSaveEdit = async () => {
    await updateTaskDetails(task.id, {
      title: editTitle,
      description: editDescription,
    });
    setIsEditing(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Extract @mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const agent = agents.find((a) => 
        a.name.toLowerCase().includes(match![1].toLowerCase())
      );
      if (agent) mentions.push(agent.id);
    }

    await addComment(task.id, newComment, mentions);
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Task Details</h2>
        <button
          onClick={() => selectTask(null)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status */}
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

        {/* Title & Description */}
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
            <p className="text-sm text-zinc-400">
              {task.description || 'Click to add description...'}
            </p>
          </div>
        )}

        {/* Priority */}
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

        {/* Assignees */}
        <div>
          <label className="block text-xs text-zinc-500 mb-2">Assigned To</label>
          <div className="flex flex-wrap gap-2">
            {agents.map((agent) => {
              const isAssigned = task.assignees?.some((a) => a.id === agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => handleAssigneeToggle(agent.id)}
                  className={`
                    px-2 py-1 text-xs rounded-full border transition-colors
                    ${isAssigned
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                    }
                  `}
                >
                  {agent.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Domains */}
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

        {/* Comments */}
        <div className="pt-4 border-t border-zinc-800">
          <label className="block text-xs text-zinc-500 mb-2">
            Comments ({comments.length})
          </label>
          
          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-zinc-300">
                    {comment.from_user ? 'You' : comment.agent?.name || 'Agent'}
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

          {/* Add comment */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment... @mention agents"
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
