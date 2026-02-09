import { useState } from 'react';
import { useAgentStore } from '../../stores/agents';
import { BoardroomPresetPicker } from './BoardroomPresetPicker';
import { getSessionPreset, type BoardroomSessionType } from '../../types/boardroom';

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
  }) => void;
}

export function CreateSessionModal({ isOpen, onClose, onCreateSession }: CreateSessionModalProps) {
  const teams = useAgentStore((s) => s.teams);
  const [sessionType, setSessionType] = useState<BoardroomSessionType>('standup');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [maxTurns, setMaxTurns] = useState(getSessionPreset('standup').defaultMaxTurns);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

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

  const handleSubmit = () => {
    if (!title.trim() || selectedAgents.size === 0) return;
    onCreateSession({
      title: title.trim(),
      topic: topic.trim(),
      session_type: sessionType,
      participant_agent_ids: Array.from(selectedAgents),
      max_turns: maxTurns,
      scheduled_at: scheduleMode === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
    // Reset form
    setTitle('');
    setTopic('');
    setSelectedAgents(new Set());
    setSessionType('standup');
    setMaxTurns(getSessionPreset('standup').defaultMaxTurns);
    setScheduleMode('now');
    setScheduledAt('');
    onClose();
  };

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
                          <button
                            key={agent.id}
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
              {scheduleMode === 'now' ? 'Start Session' : 'Schedule Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
