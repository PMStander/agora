import { useState, useRef } from 'react';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore } from '../../stores/missionControl';
import { AGENTS, type MissionPriority } from '../../types/supabase';

export function CreateMissionModal() {
  const { createMission } = useMissionControl();
  const { isCreateModalOpen, setCreateModalOpen } = useMissionControlStore();

  // ── Form state ─────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [mediaFiles, setMediaFiles] = useState<Array<{ url: string; type: string; name: string }>>([]);
  const [agentId, setAgentId] = useState(AGENTS[0].id);
  const [priority, setPriority] = useState<MissionPriority>('medium');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewAgentId, setReviewAgentId] = useState(AGENTS[0].id);
  const [maxRevisions, setMaxRevisions] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isCreateModalOpen) return null;

  const resetForm = () => {
    setTitle('');
    setInstructions('');
    setMediaFiles([]);
    setAgentId(AGENTS[0].id);
    setPriority('medium');
    setScheduleMode('now');
    setScheduleDate('');
    setScheduleTime('');
    setReviewEnabled(false);
    setReviewAgentId(AGENTS[0].id);
    setMaxRevisions(1);
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newMedia = Array.from(files).map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type,
      name: f.name,
    }));
    setMediaFiles((prev) => [...prev, ...newMedia]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !agentId) return;

    setIsSubmitting(true);

    let scheduled_at: string;
    if (scheduleMode === 'now') {
      scheduled_at = new Date().toISOString();
    } else {
      scheduled_at = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    const initialStatus = scheduleMode === 'now' ? 'assigned' : 'scheduled';

    try {
      await createMission({
        title: title.trim(),
        description: instructions || undefined,
        input_text: instructions || undefined,
        input_media: mediaFiles,
        agent_id: agentId,
        priority,
        scheduled_at,
        review_enabled: reviewEnabled,
        review_agent_id: reviewEnabled ? reviewAgentId : null,
        max_revisions: reviewEnabled ? maxRevisions : 1,
        status: initialStatus,
        mission_status: initialStatus,
        mission_phase: 'tasks',
        mission_phase_status: 'approved',
        mission_statement: instructions || title.trim(),
      });

      resetForm();
      setCreateModalOpen(false);
    } catch (err) {
      console.error('Failed to create mission:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityOptions: { value: MissionPriority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'text-zinc-400' },
    { value: 'medium', label: 'Medium', color: 'text-blue-400' },
    { value: 'high', label: 'High', color: 'text-orange-400' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-400' },
  ];

  // Group agents by team for dropdown display
  const orchestrators = AGENTS.filter((a) => a.team === 'orchestrator');
  const personalAgents = AGENTS.filter((a) => a.team === 'personal');
  const businessAgents = AGENTS.filter((a) => a.team === 'business');

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && setCreateModalOpen(false)}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Create Mission</h2>
          <button
            onClick={() => setCreateModalOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the mission?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Detailed instructions for the agent (supports markdown)..."
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none transition-colors font-mono text-sm"
            />
          </div>

          {/* Media attachments */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Media</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileAttach}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 border-dashed rounded-lg text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
            >
              📎 Attach files
            </button>
            {mediaFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {mediaFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400"
                  >
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="text-zinc-500 hover:text-red-400 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assign Agent */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Assign Agent *</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <optgroup label="🏛️ Orchestrator">
                {orchestrators.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} — {a.role}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🧘 Personal Team">
                {personalAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} — {a.role}
                  </option>
                ))}
              </optgroup>
              <optgroup label="⚔️ Business Team">
                {businessAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} — {a.role}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Priority</label>
            <div className="flex items-center gap-4">
              {priorityOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="priority"
                    checked={priority === opt.value}
                    onChange={() => setPriority(opt.value)}
                    className="accent-amber-500"
                  />
                  <span className={`text-sm ${opt.color}`}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Schedule</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === 'now'}
                  onChange={() => setScheduleMode('now')}
                  className="accent-amber-500"
                />
                <span className="text-sm text-zinc-300">Run Now</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === 'schedule'}
                  onChange={() => setScheduleMode('schedule')}
                  className="accent-amber-500"
                />
                <span className="text-sm text-zinc-300">Schedule:</span>
              </label>
              {scheduleMode === 'schedule' && (
                <div className="flex items-center gap-2 ml-6">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* AI Review Section */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-medium text-zinc-400">AI Review</span>
              <div className="flex-1 h-px bg-zinc-700" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={reviewEnabled}
                onChange={(e) => setReviewEnabled(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span className="text-sm text-zinc-300">Enable AI Review</span>
            </label>

            {reviewEnabled && (
              <div className="space-y-3 ml-6 animate-fadeIn">
                <div>
                  <label className="block text-sm text-zinc-500 mb-1">Review Agent</label>
                  <select
                    value={reviewAgentId}
                    onChange={(e) => setReviewAgentId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    {AGENTS.filter((a) => a.id !== agentId).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emoji} {a.name} — {a.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-500 mb-1">Max Revisions</label>
                  <select
                    value={maxRevisions}
                    onChange={(e) => setMaxRevisions(Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
