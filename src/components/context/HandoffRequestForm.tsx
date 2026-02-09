import { useState } from 'react';
import { useHandoff } from '../../hooks/useHandoff';
import { useAgentRegistry } from '../../hooks/useAgentRegistry';
import type { HandoffRequest } from '../../types/context';

interface HandoffRequestFormProps {
  requestingAgentId: string;
  taskId?: string;
  missionId?: string;
  onCreated?: (handoff: HandoffRequest) => void;
  onCancel: () => void;
}

export function HandoffRequestForm({
  requestingAgentId,
  taskId,
  missionId,
  onCreated,
  onCancel,
}: HandoffRequestFormProps) {
  const { createHandoff } = useHandoff();
  const { agents } = useAgentRegistry();
  const [targetAgentId, setTargetAgentId] = useState('');
  const [reason, setReason] = useState('');
  const [contextSummary, setContextSummary] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);

  const availableAgents = agents.filter((a) => a.agent_id !== requestingAgentId);

  const handleSubmit = async () => {
    if (!targetAgentId || !reason) return;
    setSubmitting(true);

    const handoff = await createHandoff({
      requesting_agent_id: requestingAgentId,
      target_agent_id: targetAgentId,
      task_id: taskId || null,
      mission_id: missionId || null,
      reason,
      context_summary: contextSummary,
      priority,
    });

    setSubmitting(false);
    if (handoff) {
      onCreated?.(handoff);
    }
  };

  return (
    <div className="space-y-3 p-3 rounded-lg border border-zinc-700 bg-zinc-800/50">
      <h4 className="text-xs font-medium text-zinc-200 uppercase tracking-wider">
        New Handoff Request
      </h4>

      {/* Target agent */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Target Agent</label>
        <select
          value={targetAgentId}
          onChange={(e) => setTargetAgentId(e.target.value)}
          className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:border-amber-500 focus:outline-none"
        >
          <option value="">Select agent...</option>
          {availableAgents.map((a) => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.display_name} ({a.role}) - {a.availability}
            </option>
          ))}
        </select>
      </div>

      {/* Reason */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Reason</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this handoff needed?"
          className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Context */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Context Summary</label>
        <textarea
          value={contextSummary}
          onChange={(e) => setContextSummary(e.target.value)}
          placeholder="What does the target agent need to know?"
          rows={3}
          className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 resize-none focus:border-amber-500 focus:outline-none"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="text-xs text-zinc-500 block mb-1">Priority</label>
        <div className="flex gap-1">
          {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                priority === p
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={submitting || !targetAgentId || !reason}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            submitting || !targetAgentId || !reason
              ? 'bg-amber-500/10 text-amber-400/50 cursor-not-allowed'
              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
          }`}
        >
          {submitting ? 'Creating...' : 'Create Handoff'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
