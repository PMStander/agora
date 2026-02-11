import { useState, useRef } from 'react';
import { useAgentStore } from '../../stores/agents';
import { BoardroomPresetPicker } from './BoardroomPresetPicker';
import { EntitySearchInput } from './EntitySearchInput';
import {
  getSessionPreset,
  type BoardroomSessionType,
  type BoardroomSessionMetadata,
  type EntityReference,
  type PrepAssignment,
  type PrepMode,
} from '../../types/boardroom';
import type { MediaAttachment } from '../../types/supabase';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (data: {
    title: string;
    topic: string;
    session_type: BoardroomSessionType;
    participant_agent_ids: string[];
    max_turns: number;
    scheduled_at: string | null;
    metadata: BoardroomSessionMetadata;
  }) => void;
}

export function CreateSessionModal({ isOpen, onClose, onCreateSession }: CreateSessionModalProps) {
  const teams = useAgentStore((s) => s.teams);
  const allAgents = teams.flatMap((t) => t.agents);

  // ── Existing state ──
  const [sessionType, setSessionType] = useState<BoardroomSessionType>('standup');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [maxTurns, setMaxTurns] = useState(getSessionPreset('standup').defaultMaxTurns);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  // ── New: Context & Preparation state ──
  const [entityRefs, setEntityRefs] = useState<EntityReference[]>([]);
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [prepEnabled, setPrepEnabled] = useState(false);
  const [prepAssignments, setPrepAssignments] = useState<PrepAssignment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleTypeChange = (type: BoardroomSessionType) => {
    setSessionType(type);
    setMaxTurns(getSessionPreset(type).defaultMaxTurns);
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const selectAllTeam = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      const allSelected = team.agents.every((a) => next.has(a.id));
      if (allSelected) {
        team.agents.forEach((a) => next.delete(a.id));
      } else {
        team.agents.forEach((a) => next.add(a.id));
      }
      return next;
    });
  };

  // ── File attachments ──
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newMedia = Array.from(files).map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type,
      name: f.name,
    }));
    setAttachments((prev) => [...prev, ...newMedia]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Prep assignments ──
  const addPrepAssignment = () => {
    setPrepAssignments((prev) => [
      ...prev,
      { agent_id: allAgents[0]?.id || '', mode: 'research' as PrepMode, prompt: '' },
    ]);
  };

  const updatePrepAssignment = (index: number, updates: Partial<PrepAssignment>) => {
    setPrepAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const removePrepAssignment = (index: number) => {
    setPrepAssignments((prev) => prev.filter((_, i) => i !== index));
  };

  const hasPrepWork = prepEnabled && prepAssignments.some((a) => a.prompt.trim() && a.agent_id);

  const handleSubmit = () => {
    if (!title.trim() || selectedAgents.size === 0) return;

    const metadata: BoardroomSessionMetadata = {};
    if (entityRefs.length > 0) metadata.entity_references = entityRefs;
    if (attachments.length > 0) metadata.attachments = attachments;
    if (hasPrepWork) {
      metadata.preparation = {
        assignments: prepAssignments.filter((a) => a.prompt.trim() && a.agent_id),
        results: [],
        status: 'pending',
      };
    }

    onCreateSession({
      title: title.trim(),
      topic: topic.trim(),
      session_type: sessionType,
      participant_agent_ids: Array.from(selectedAgents),
      max_turns: maxTurns,
      scheduled_at: scheduleMode === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      metadata,
    });

    // Reset form
    setTitle('');
    setTopic('');
    setSelectedAgents(new Set());
    setSessionType('standup');
    setMaxTurns(getSessionPreset('standup').defaultMaxTurns);
    setScheduleMode('now');
    setScheduledAt('');
    setEntityRefs([]);
    setAttachments([]);
    setPrepEnabled(false);
    setPrepAssignments([]);
    onClose();
  };

  const submitLabel = hasPrepWork
    ? 'Create & Prepare'
    : scheduleMode === 'now'
      ? 'Start Session'
      : 'Schedule Session';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-zinc-100">New Boardroom Session</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            Cancel
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Session type picker */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-2">Session Type</label>
            <BoardroomPresetPicker selected={sessionType} onSelect={handleTypeChange} />
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monday morning standup"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Topic (optional)</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should agents discuss?"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* ── Context & Preparation (collapsible) ── */}
          <details className="group">
            <summary className="text-xs text-zinc-500 uppercase tracking-wider cursor-pointer select-none flex items-center gap-1.5 hover:text-zinc-400 transition-colors">
              <span className="text-[10px] transition-transform group-open:rotate-90">&#9654;</span>
              Context & Preparation
              {(entityRefs.length > 0 || attachments.length > 0 || hasPrepWork) && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400 rounded-full">
                  {entityRefs.length + attachments.length + (hasPrepWork ? prepAssignments.length : 0)}
                </span>
              )}
            </summary>
            <div className="mt-3 space-y-4 pl-1">
              {/* Entity references */}
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Reference Entities</label>
                <EntitySearchInput value={entityRefs} onChange={setEntityRefs} />
              </div>

              {/* File attachments */}
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Attachments</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileAttach}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  + Attach Files
                </button>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {attachments.map((file, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300"
                      >
                        {file.name}
                        <button onClick={() => removeAttachment(i)} className="ml-1 text-zinc-500 hover:text-zinc-300">
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preparation assignments */}
              <div>
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prepEnabled}
                    onChange={(e) => {
                      setPrepEnabled(e.target.checked);
                      if (e.target.checked && prepAssignments.length === 0) addPrepAssignment();
                    }}
                    className="accent-amber-500"
                  />
                  Assign preparation work
                </label>

                {prepEnabled && (
                  <div className="mt-2 space-y-3 border-l-2 border-amber-500/30 pl-3">
                    {prepAssignments.map((assignment, idx) => (
                      <div key={idx} className="space-y-2 bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          {/* Agent picker */}
                          <select
                            value={assignment.agent_id}
                            onChange={(e) => updatePrepAssignment(idx, { agent_id: e.target.value })}
                            className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                          >
                            {allAgents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.emoji} {agent.name} — {agent.role}
                              </option>
                            ))}
                          </select>

                          {/* Mode toggle */}
                          <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
                            <button
                              onClick={() => updatePrepAssignment(idx, { mode: 'research' })}
                              className={`px-2 py-1 text-[10px] transition-colors ${
                                assignment.mode === 'research'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              Research
                            </button>
                            <button
                              onClick={() => updatePrepAssignment(idx, { mode: 'mission' })}
                              className={`px-2 py-1 text-[10px] transition-colors ${
                                assignment.mode === 'mission'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              Mission
                            </button>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => removePrepAssignment(idx)}
                            className="text-zinc-600 hover:text-zinc-400 text-sm"
                          >
                            &times;
                          </button>
                        </div>

                        {/* Prep brief */}
                        <textarea
                          value={assignment.prompt}
                          onChange={(e) => updatePrepAssignment(idx, { prompt: e.target.value })}
                          placeholder={
                            assignment.mode === 'research'
                              ? 'What should this agent research before the session?'
                              : 'Describe the mission brief for preparation...'
                          }
                          rows={2}
                          className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
                        />

                        {/* Delegate to (optional) */}
                        <details className="text-[10px]">
                          <summary className="text-zinc-600 cursor-pointer hover:text-zinc-400">
                            Delegate to assistants (optional)
                          </summary>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {allAgents
                              .filter((a) => a.id !== assignment.agent_id)
                              .map((agent) => {
                                const isDelegated = assignment.delegate_to?.includes(agent.id);
                                return (
                                  <button
                                    key={agent.id}
                                    onClick={() => {
                                      const current = assignment.delegate_to || [];
                                      const next = isDelegated
                                        ? current.filter((id) => id !== agent.id)
                                        : [...current, agent.id];
                                      updatePrepAssignment(idx, { delegate_to: next });
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                      isDelegated
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                                    }`}
                                  >
                                    {agent.emoji} {agent.name}
                                  </button>
                                );
                              })}
                          </div>
                        </details>
                      </div>
                    ))}

                    <button
                      onClick={addPrepAssignment}
                      className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
                    >
                      + Add preparation task
                    </button>
                  </div>
                )}
              </div>
            </div>
          </details>

          {/* Participants */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-2">
              Participants ({selectedAgents.size} selected)
            </label>
            <div className="space-y-3">
              {teams.map((team) => {
                const allSelected = team.agents.every((a) => selectedAgents.has(a.id));
                return (
                  <div key={team.id}>
                    <button
                      onClick={() => selectAllTeam(team.id)}
                      className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-1"
                    >
                      <span className={`w-3 h-3 rounded border ${allSelected ? 'bg-amber-500 border-amber-500' : 'border-zinc-600'} flex items-center justify-center`}>
                        {allSelected && <span className="text-[8px] text-black">✓</span>}
                      </span>
                      {team.emoji} {team.name}
                    </button>
                    <div className="flex flex-wrap gap-1.5 ml-5">
                      {team.agents.map((agent) => {
                        const isSelected = selectedAgents.has(agent.id);
                        return (
                          <div key={agent.id} className="relative group">
                            <button
                              onClick={() => toggleAgent(agent.id)}
                              className={`
                                flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all border
                                ${isSelected
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                                }
                              `}
                            >
                              <span>{agent.emoji}</span>
                              {agent.name}
                            </button>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-zinc-300 bg-zinc-950 border border-zinc-700 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {agent.role}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Max turns slider */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">
              Max Turns: {maxTurns}
            </label>
            <input
              type="range"
              min={3}
              max={30}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>3</span>
              <span>30</span>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-2">When</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScheduleMode('now')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  scheduleMode === 'now'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                }`}
              >
                Start Now
              </button>
              <button
                onClick={() => setScheduleMode('later')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  scheduleMode === 'later'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                }`}
              >
                Schedule
              </button>
            </div>
            {scheduleMode === 'later' && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
              />
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || selectedAgents.size === 0}
              className="px-4 py-2 text-sm font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
