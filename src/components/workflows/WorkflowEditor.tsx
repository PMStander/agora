import { useState, useEffect } from 'react';
import { useSelectedWorkflow } from '../../stores/workflows';
import { useWorkflows } from '../../hooks/useWorkflows';
import { TriggerConfig } from './TriggerConfig';
import { ActionStepEditor } from './ActionStepEditor';
import type {
  Workflow,
  TriggerType,
  TriggerEntity,
  ActionStep,
  WorkflowStatus,
} from '../../types/workflows';
import { WORKFLOW_STATUS_CONFIG } from '../../types/workflows';

interface WorkflowEditorProps {
  onClose: () => void;
}

export function WorkflowEditor({ onClose }: WorkflowEditorProps) {
  const existing = useSelectedWorkflow();
  const { createWorkflow, updateWorkflowDetails } = useWorkflows();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<WorkflowStatus>('draft');
  const [triggerType, setTriggerType] = useState<TriggerType>('entity_created');
  const [triggerEntity, setTriggerEntity] = useState<TriggerEntity | null>(null);
  const [triggerConditions, setTriggerConditions] = useState<Record<string, unknown>>({});
  const [triggerSchedule, setTriggerSchedule] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionStep[]>([]);
  const [saving, setSaving] = useState(false);

  // Populate form when editing existing
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description || '');
      setStatus(existing.status);
      setTriggerType(existing.trigger_type);
      setTriggerEntity(existing.trigger_entity);
      setTriggerConditions(existing.trigger_conditions || {});
      setTriggerSchedule(existing.trigger_schedule);
      setActions(existing.actions || []);
    }
  }, [existing]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      trigger_type: triggerType,
      trigger_entity: triggerEntity,
      trigger_conditions: triggerConditions,
      trigger_schedule: triggerSchedule || undefined,
      actions,
    };

    if (existing) {
      await updateWorkflowDetails(existing.id, payload as Partial<Workflow>);
    } else {
      await createWorkflow(payload);
    }

    setSaving(false);
    onClose();
  };

  const addAction = () => {
    setActions([...actions, { type: 'create_mission' }]);
  };

  const updateAction = (index: number, step: ActionStep) => {
    const next = [...actions];
    next[index] = step;
    setActions(next);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const moveAction = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    [next[index], next[target]] = [next[target], next[index]];
    setActions(next);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-zinc-200">
            {existing ? 'Edit Workflow' : 'New Workflow'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50"
          >
            {Object.entries(WORKFLOW_STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Name & Description */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              Workflow name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New lead onboarding"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>
        </div>

        {/* Trigger Config */}
        <TriggerConfig
          triggerType={triggerType}
          triggerEntity={triggerEntity}
          triggerConditions={triggerConditions}
          triggerSchedule={triggerSchedule}
          onChange={(updates) => {
            if (updates.trigger_type !== undefined)
              setTriggerType(updates.trigger_type);
            if (updates.trigger_entity !== undefined)
              setTriggerEntity(updates.trigger_entity);
            if (updates.trigger_conditions !== undefined)
              setTriggerConditions(updates.trigger_conditions);
            if (updates.trigger_schedule !== undefined)
              setTriggerSchedule(updates.trigger_schedule);
          }}
        />

        {/* Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">
              Actions ({actions.length})
            </h3>
            <button
              onClick={addAction}
              className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              + Add Step
            </button>
          </div>

          {actions.length === 0 ? (
            <p className="text-xs text-zinc-600 py-4 text-center border border-dashed border-zinc-700 rounded-lg">
              No actions yet. Add a step to define what happens when this workflow triggers.
            </p>
          ) : (
            <div className="space-y-2">
              {actions.map((action, i) => (
                <ActionStepEditor
                  key={i}
                  step={action}
                  index={i}
                  total={actions.length}
                  onChange={updateAction}
                  onRemove={removeAction}
                  onMoveUp={(idx) => moveAction(idx, 'up')}
                  onMoveDown={(idx) => moveAction(idx, 'down')}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
