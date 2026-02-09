import { useEffect, useState } from 'react';
import { useMissionControl } from '../../hooks/useMissionControl';
import { isRootMissionPlaceholder } from '../../lib/taskDependencies';
import { useMissionControlStore } from '../../stores/missionControl';
import { ALL_DOMAINS, type TaskPriority } from '../../types/supabase';

function nowDateTimeParts() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export function CreateTaskModal() {
  const { createTask, agents } = useMissionControl();
  const { isCreateModalOpen, setCreateModalOpen, tasks, selectedMissionId } = useMissionControlStore();
  const defaults = nowDateTimeParts();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [primaryAgentId, setPrimaryAgentId] = useState(agents[0]?.id ?? 'main');
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewAgentId, setReviewAgentId] = useState(
    agents.find((a: { id: string }) => a.id !== (agents[0]?.id ?? 'main'))?.id ?? null
  );
  const [maxRevisions, setMaxRevisions] = useState(0);
  const [dueDate, setDueDate] = useState(defaults.date);
  const [dueTime, setDueTime] = useState(defaults.time);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [dependencyTaskIds, setDependencyTaskIds] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Array<{ url: string; type: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      for (const file of mediaFiles) {
        if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
      }
    };
  }, [mediaFiles]);

  useEffect(() => {
    if (isCreateModalOpen) return;
    setDependencyTaskIds([]);
  }, [isCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const dueAt = new Date(`${dueDate}T${dueTime}`).toISOString();
    setIsSubmitting(true);
    try {
      await createTask({
        title: title.trim(),
        description,
        inputText: description,
        dueAt,
        primaryAgentId,
        priority,
        domains: selectedDomains,
        assigneeIds: [primaryAgentId],
        media: mediaFiles,
        reviewEnabled,
        reviewAgentId: reviewEnabled ? reviewAgentId : null,
        maxRevisions: reviewEnabled ? maxRevisions : 0,
        rootTaskId: selectedMissionId || null,
        dependencyTaskIds,
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setPrimaryAgentId(agents[0]?.id ?? 'main');
      setReviewEnabled(false);
      setReviewAgentId(agents.find((a: { id: string }) => a.id !== (agents[0]?.id ?? 'main'))?.id ?? null);
      setMaxRevisions(0);
      const nextDefaults = nowDateTimeParts();
      setDueDate(nextDefaults.date);
      setDueTime(nextDefaults.time);
      setSelectedDomains([]);
      setDependencyTaskIds([]);
      for (const file of mediaFiles) {
        if (file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
      }
      setMediaFiles([]);
      setCreateModalOpen(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain]
    );
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const nextFiles = Array.from(files).map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name,
    }));
    setMediaFiles((prev) => [...prev, ...nextFiles]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      const file = prev[index];
      if (file?.url?.startsWith('blob:')) URL.revokeObjectURL(file.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const reviewerOptions = agents.filter((a: { id: string }) => a.id !== primaryAgentId);
  const dependencyCandidates = tasks.filter((task) => {
    if (selectedMissionId) {
      return (task.root_task_id || task.id) === selectedMissionId
        && task.id !== selectedMissionId
        && !isRootMissionPlaceholder(task, tasks);
    }
    return task.id !== selectedMissionId && !isRootMissionPlaceholder(task, tasks);
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Create Mission Task</h2>
          <button
            onClick={() => setCreateModalOpen(false)}
            className="text-zinc-500 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What mission task needs to be done?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Priority + Primary Agent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">🔥 Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Primary Agent</label>
              <select
                value={primaryAgentId}
                onChange={(e) => {
                  const nextPrimary = e.target.value;
                  setPrimaryAgentId(nextPrimary);
                  if (nextPrimary === reviewAgentId) {
                    setReviewAgentId(agents.find((agent: { id: string }) => agent.id !== nextPrimary)?.id ?? null);
                  }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {agents.map((agent: { id: string; name: string; emoji: string; role: string }) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.emoji} {agent.name} - {agent.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date/time */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Due Date & Time</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Media attachments */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Media Attachments</label>
            <input
              id="task-media-files"
              type="file"
              multiple
              onChange={handleFileAttach}
              className="hidden"
            />
            <label
              htmlFor="task-media-files"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 border-dashed rounded-lg text-zinc-400 hover:border-zinc-600 cursor-pointer"
            >
              <span>📎</span>
              <span>Attach Files</span>
            </label>
            {mediaFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {mediaFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-300"
                  >
                    <span className="truncate max-w-[160px]">{file.name}</span>
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-red-400"
                      onClick={() => removeMedia(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI review */}
          <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={reviewEnabled}
                onChange={(e) => setReviewEnabled(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Enable AI review loop</span>
            </label>
            {reviewEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Review Agent</label>
                  <select
                    value={reviewAgentId ?? ''}
                    onChange={(e) => setReviewAgentId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    {reviewerOptions.map((agent: { id: string; name: string; emoji: string }) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.emoji} {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Max Revisions</label>
                  <select
                    value={maxRevisions}
                    onChange={(e) => setMaxRevisions(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
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
          </div>

          <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
            <label className="block text-sm text-zinc-400">Mission Task Dependencies</label>
            {dependencyCandidates.length === 0 && (
              <div className="text-xs text-zinc-600">No available missions to depend on.</div>
            )}
            {dependencyCandidates.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {dependencyCandidates.map((task) => {
                  const selected = dependencyTaskIds.includes(task.id);
                  return (
                    <label
                      key={task.id}
                      className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          setDependencyTaskIds((prev) =>
                            prev.includes(task.id)
                              ? prev.filter((id) => id !== task.id)
                              : [...prev, task.id]
                          );
                        }}
                        className="accent-amber-500"
                      />
                      <span className="truncate">{task.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Domains */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Domains (for auto-routing)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {ALL_DOMAINS.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  className={`
                    px-2 py-1 text-xs rounded-full border transition-colors
                    ${selectedDomains.includes(domain)
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }
                  `}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating mission...' : 'Create Mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
