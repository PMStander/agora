import type { ActionStep, ActionStepType } from '../../types/workflows';
import { ACTION_TYPE_CONFIG } from '../../types/workflows';
import { AGENTS } from '../../types/supabase';

const ACTION_TYPES = Object.entries(ACTION_TYPE_CONFIG) as [
  ActionStepType,
  { label: string; description: string }
][];

interface ActionStepEditorProps {
  step: ActionStep;
  index: number;
  total: number;
  onChange: (index: number, step: ActionStep) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function ActionStepEditor({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ActionStepEditorProps) {
  const update = (patch: Partial<ActionStep>) =>
    onChange(index, { ...step, ...patch });

  return (
    <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono">#{index + 1}</span>
          <select
            value={step.type}
            onChange={(e) => update({ type: e.target.value as ActionStepType })}
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
          >
            {ACTION_TYPES.map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
            title="Move up"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            className="p-1 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
            title="Move down"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => onRemove(index)}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
            title="Remove step"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Type-specific fields */}
      <div className="space-y-2">
        {step.type === 'create_mission' && (
          <>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Agent</label>
              <select
                value={step.agent_id || ''}
                onChange={(e) => update({ agent_id: e.target.value })}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Select agent...</option>
                {AGENTS.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.emoji} {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Mission title</label>
              <input
                type="text"
                value={step.mission_title || ''}
                onChange={(e) => update({ mission_title: e.target.value })}
                placeholder="Mission title"
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Template / Instructions</label>
              <textarea
                value={step.template || ''}
                onChange={(e) => update({ template: e.target.value })}
                placeholder="Describe what the agent should do..."
                rows={2}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>
          </>
        )}

        {step.type === 'update_field' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Field</label>
                <input
                  type="text"
                  value={step.field || ''}
                  onChange={(e) => update({ field: e.target.value })}
                  placeholder="e.g. lifecycle_status"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Value</label>
                <input
                  type="text"
                  value={step.value || ''}
                  onChange={(e) => update({ value: e.target.value })}
                  placeholder="New value"
                  className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          </>
        )}

        {step.type === 'send_notification' && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Message</label>
            <textarea
              value={step.message || ''}
              onChange={(e) => update({ message: e.target.value })}
              placeholder="Notification message..."
              rows={2}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>
        )}

        {step.type === 'create_interaction' && (
          <>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Type</label>
              <select
                value={step.interaction_type || 'note'}
                onChange={(e) => update({ interaction_type: e.target.value })}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="task">Task</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Body</label>
              <textarea
                value={step.body || ''}
                onChange={(e) => update({ body: e.target.value })}
                placeholder="Interaction body..."
                rows={2}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>
          </>
        )}

        {step.type === 'wait' && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Duration</label>
            <input
              type="text"
              value={step.duration || ''}
              onChange={(e) => update({ duration: e.target.value })}
              placeholder="e.g. 3d, 1h, 30m"
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        )}

        {step.type === 'create_task' && (
          <>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Title</label>
              <input
                type="text"
                value={step.title || ''}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Task title"
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Agent</label>
              <select
                value={step.agent_id || ''}
                onChange={(e) => update({ agent_id: e.target.value })}
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Select agent...</option>
                {AGENTS.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.emoji} {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
