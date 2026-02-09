import { memo, useCallback, useMemo, useState } from 'react';
import { AGENTS } from '../../types/supabase';
import type {
  PlannerOutput,
  PlannerPhaseOutput,
  PlannerTaskOutput,
  PhaseGateType,
  FailurePolicy,
} from '../../types/missionPlan';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PlanEditorProps {
  plan: PlannerOutput;
  onChange: (plan: PlannerOutput) => void;
  validationErrors?: Array<{ path: string; message: string }>;
  readOnly?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GATE_TYPE_OPTIONS: Array<{ value: PhaseGateType; label: string }> = [
  { value: 'all_complete', label: 'All Tasks Complete' },
  { value: 'review_approved', label: 'Review Approved' },
  { value: 'test_pass', label: 'Tests Pass' },
  { value: 'manual_approval', label: 'Manual Approval' },
];

const FAILURE_POLICY_OPTIONS: Array<{ value: FailurePolicy; label: string }> = [
  { value: 'stop_phase', label: 'Stop Phase' },
  { value: 'stop_mission', label: 'Stop Mission' },
  { value: 'continue', label: 'Continue' },
];

const PRIORITY_OPTIONS: Array<{
  value: 'low' | 'medium' | 'high' | 'urgent';
  label: string;
  color: string;
  activeColor: string;
}> = [
  { value: 'low', label: 'Low', color: 'text-zinc-400 border-zinc-600', activeColor: 'bg-zinc-400 text-zinc-950 border-zinc-400' },
  { value: 'medium', label: 'Med', color: 'text-blue-400 border-blue-500/40', activeColor: 'bg-blue-400 text-zinc-950 border-blue-400' },
  { value: 'high', label: 'High', color: 'text-orange-400 border-orange-500/40', activeColor: 'bg-orange-400 text-zinc-950 border-orange-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-400 border-red-500/40', activeColor: 'bg-red-400 text-zinc-950 border-red-400' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function circuitBreakerLabel(plan: PlannerOutput): string {
  const cb = plan.circuit_breaker;
  if (!cb) return 'Default (Stop Phase on 2 failures)';
  const policyLabel = cb.on_task_failure === 'stop_phase'
    ? 'Stop Phase'
    : cb.on_task_failure === 'stop_mission'
      ? 'Stop Mission'
      : 'Continue';
  return `${policyLabel} on ${cb.max_phase_failures ?? 2} failure${(cb.max_phase_failures ?? 2) !== 1 ? 's' : ''}`;
}

function getErrorsForPath(
  errors: Array<{ path: string; message: string }> | undefined,
  path: string,
): string[] {
  if (!errors) return [];
  return errors.filter((e) => e.path === path || e.path.startsWith(path + '.')).map((e) => e.message);
}

function getAllTaskKeys(plan: PlannerOutput): string[] {
  const keys: string[] = [];
  for (const phase of plan.phases) {
    for (const task of phase.tasks) {
      if (task.key) keys.push(task.key);
    }
  }
  return keys;
}

// ─── TaskCard (memoized) ────────────────────────────────────────────────────

interface TaskCardEditorProps {
  task: PlannerTaskOutput;
  phaseIndex: number;
  taskIndex: number;
  allTaskKeys: string[];
  validationErrors?: Array<{ path: string; message: string }>;
  readOnly: boolean;
  onUpdateTask: (phaseIndex: number, taskIndex: number, updated: PlannerTaskOutput) => void;
  onRemoveTask: (phaseIndex: number, taskIndex: number) => void;
}

const TaskCardEditor = memo(function TaskCardEditor({
  task,
  phaseIndex,
  taskIndex,
  allTaskKeys,
  validationErrors,
  readOnly,
  onUpdateTask,
  onRemoveTask,
}: TaskCardEditorProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [depDropdownOpen, setDepDropdownOpen] = useState(false);

  const basePath = `phases[${phaseIndex}].tasks[${taskIndex}]`;
  const fieldErrors = useCallback(
    (field: string) => getErrorsForPath(validationErrors, `${basePath}.${field}`),
    [validationErrors, basePath],
  );
  const cardErrors = getErrorsForPath(validationErrors, basePath);
  const hasError = cardErrors.length > 0;

  const update = (partial: Partial<PlannerTaskOutput>) => {
    onUpdateTask(phaseIndex, taskIndex, { ...task, ...partial });
  };

  const availableDeps = allTaskKeys.filter(
    (k) => k !== task.key && !(task.depends_on ?? []).includes(k),
  );

  const removeDep = (dep: string) => {
    update({ depends_on: (task.depends_on ?? []).filter((d) => d !== dep) });
  };

  const addDep = (dep: string) => {
    update({ depends_on: [...(task.depends_on ?? []), dep] });
    setDepDropdownOpen(false);
  };

  const removeDomain = (domain: string) => {
    update({ domains: (task.domains ?? []).filter((d) => d !== domain) });
  };

  const selectedAgent = AGENTS.find((a) => a.id === task.agent_id);
  const reviewAgent = task.review_agent_id ? AGENTS.find((a) => a.id === task.review_agent_id) : null;

  return (
    <div
      className={`bg-zinc-900 border rounded-lg p-4 transition-colors ${
        hasError ? 'border-red-500/60' : 'border-zinc-700'
      }`}
    >
      {/* Task header row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Task key badge */}
        <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-xs font-mono text-zinc-400">
          {task.key || '...'}
        </span>

        {/* Editable title */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={task.title}
            onChange={(e) => {
              const newTitle = e.target.value;
              const newKey = slugify(newTitle);
              update({ title: newTitle, key: newKey });
            }}
            disabled={readOnly}
            placeholder="Task title..."
            className={`w-full bg-zinc-800 border rounded px-2 py-1 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none disabled:opacity-60 ${
              fieldErrors('title').length > 0 ? 'border-red-500' : 'border-zinc-700'
            }`}
          />
          {fieldErrors('title').map((msg, i) => (
            <p key={i} className="text-xs text-red-400 mt-0.5">{msg}</p>
          ))}
        </div>

        {/* Remove button */}
        {!readOnly && (
          <button
            onClick={() => onRemoveTask(phaseIndex, taskIndex)}
            className="shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Remove task"
          >
            x
          </button>
        )}
      </div>

      {/* Agent + Priority row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {/* Agent selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Agent</label>
          <select
            value={task.agent_id}
            onChange={(e) => update({ agent_id: e.target.value })}
            disabled={readOnly}
            className={`bg-zinc-800 border rounded px-2 py-1 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none disabled:opacity-60 ${
              fieldErrors('agent_id').length > 0 ? 'border-red-500' : 'border-zinc-700'
            }`}
          >
            <option value="">Select agent...</option>
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.name} ({a.role})
              </option>
            ))}
          </select>
          {selectedAgent && (
            <span className="text-xs text-zinc-400">
              {selectedAgent.emoji} {selectedAgent.name}
            </span>
          )}
          {fieldErrors('agent_id').map((msg, i) => (
            <p key={i} className="text-xs text-red-400">{msg}</p>
          ))}
        </div>

        {/* Priority selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-zinc-500">Priority</label>
          <div className="flex gap-1">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => !readOnly && update({ priority: opt.value })}
                disabled={readOnly}
                className={`px-2 py-0.5 text-xs rounded border transition-colors disabled:opacity-60 ${
                  (task.priority ?? 'medium') === opt.value ? opt.activeColor : opt.color
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Instructions (collapsible) */}
      <div className="mb-3">
        <button
          onClick={() => setInstructionsOpen(!instructionsOpen)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="text-[10px]">{instructionsOpen ? '\u2303' : '\u2304'}</span>
          <span>Instructions</span>
          {task.instructions && !instructionsOpen && (
            <span className="text-zinc-600 truncate max-w-[200px]">
              -- {task.instructions.slice(0, 60)}{task.instructions.length > 60 ? '...' : ''}
            </span>
          )}
        </button>
        <div
          className={`overflow-hidden transition-all duration-200 ${
            instructionsOpen ? 'max-h-[400px] mt-2' : 'max-h-0'
          }`}
        >
          <textarea
            value={task.instructions}
            onChange={(e) => update({ instructions: e.target.value })}
            disabled={readOnly}
            placeholder="Task instructions for the agent..."
            rows={4}
            className={`w-full bg-zinc-800 border rounded px-2 py-1.5 text-sm text-zinc-200 resize-y focus:border-amber-500 focus:outline-none disabled:opacity-60 ${
              fieldErrors('instructions').length > 0 ? 'border-red-500' : 'border-zinc-700'
            }`}
          />
          {fieldErrors('instructions').map((msg, i) => (
            <p key={i} className="text-xs text-red-400 mt-0.5">{msg}</p>
          ))}
        </div>
      </div>

      {/* Dependencies */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <label className="text-xs text-zinc-500">Dependencies</label>
          {!readOnly && availableDeps.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setDepDropdownOpen(!depDropdownOpen)}
                className="text-xs px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
              >
                + Add
              </button>
              {depDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-zinc-800 border border-zinc-700 rounded shadow-lg max-h-40 overflow-y-auto min-w-[160px]">
                  {availableDeps.map((key) => (
                    <button
                      key={key}
                      onClick={() => addDep(key)}
                      className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(task.depends_on ?? []).length === 0 && (
            <span className="text-xs text-zinc-600">None</span>
          )}
          {(task.depends_on ?? []).map((dep) => (
            <span
              key={dep}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-600 text-xs text-zinc-300"
            >
              {dep}
              {!readOnly && (
                <button
                  onClick={() => removeDep(dep)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  x
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Review toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={task.review_enabled ?? false}
            onChange={(e) =>
              update({
                review_enabled: e.target.checked,
                review_agent_id: e.target.checked ? (task.review_agent_id ?? '') : undefined,
                max_revisions: e.target.checked ? (task.max_revisions ?? 2) : undefined,
              })
            }
            disabled={readOnly}
            className="accent-amber-500"
          />
          Review enabled
        </label>
        {task.review_enabled && (
          <>
            <select
              value={task.review_agent_id ?? ''}
              onChange={(e) => update({ review_agent_id: e.target.value || undefined })}
              disabled={readOnly}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
            >
              <option value="">Select reviewer...</option>
              {AGENTS.filter((a) => a.id !== task.agent_id).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name}
                </option>
              ))}
            </select>
            {reviewAgent && (
              <span className="text-xs text-zinc-400">{reviewAgent.emoji} {reviewAgent.name}</span>
            )}
            <div className="flex items-center gap-1">
              <label className="text-xs text-zinc-500">Max revisions</label>
              <input
                type="number"
                min={1}
                max={10}
                value={task.max_revisions ?? 2}
                onChange={(e) => update({ max_revisions: parseInt(e.target.value) || 2 })}
                disabled={readOnly}
                className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
              />
            </div>
          </>
        )}
      </div>

      {/* Domains */}
      {(task.domains ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(task.domains ?? []).map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300"
            >
              {domain}
              {!readOnly && (
                <button
                  onClick={() => removeDomain(domain)}
                  className="text-amber-400/60 hover:text-red-400 transition-colors"
                >
                  x
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Card-level errors */}
      {cardErrors
        .filter((msg) => !fieldErrors('title').includes(msg) && !fieldErrors('agent_id').includes(msg) && !fieldErrors('instructions').includes(msg))
        .map((msg, i) => (
          <p key={i} className="text-xs text-red-400 mt-2">{msg}</p>
        ))}
    </div>
  );
});

// ─── PhaseSection ───────────────────────────────────────────────────────────

interface PhaseSectionProps {
  phase: PlannerPhaseOutput;
  phaseIndex: number;
  allTaskKeys: string[];
  validationErrors?: Array<{ path: string; message: string }>;
  readOnly: boolean;
  onUpdatePhase: (phaseIndex: number, updated: PlannerPhaseOutput) => void;
  onRemovePhase: (phaseIndex: number) => void;
  onUpdateTask: (phaseIndex: number, taskIndex: number, updated: PlannerTaskOutput) => void;
  onRemoveTask: (phaseIndex: number, taskIndex: number) => void;
  onAddTask: (phaseIndex: number) => void;
}

function PhaseSection({
  phase,
  phaseIndex,
  allTaskKeys,
  validationErrors,
  readOnly,
  onUpdatePhase,
  onRemovePhase,
  onUpdateTask,
  onRemoveTask,
  onAddTask,
}: PhaseSectionProps) {
  const [descOpen, setDescOpen] = useState(!!phase.description);
  const basePath = `phases[${phaseIndex}]`;
  const phaseErrors = getErrorsForPath(validationErrors, basePath);
  const hasError = phaseErrors.length > 0;

  const updateField = (partial: Partial<PlannerPhaseOutput>) => {
    onUpdatePhase(phaseIndex, { ...phase, ...partial });
  };

  return (
    <div
      className={`border-l-4 rounded-r-lg transition-colors ${
        hasError ? 'border-l-red-500' : 'border-l-amber-500'
      }`}
    >
      {/* Phase header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900/50 rounded-tr-lg">
        {/* Phase number */}
        <span className="shrink-0 w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-sm font-bold text-amber-400">
          {phaseIndex + 1}
        </span>

        {/* Title */}
        <input
          type="text"
          value={phase.title}
          onChange={(e) => updateField({ title: e.target.value })}
          disabled={readOnly}
          placeholder="Phase title..."
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm font-medium text-zinc-100 focus:border-amber-500 focus:outline-none disabled:opacity-60"
        />

        {/* Gate type */}
        <select
          value={phase.gate_type ?? 'all_complete'}
          onChange={(e) => updateField({ gate_type: e.target.value as PhaseGateType })}
          disabled={readOnly}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:border-amber-500 focus:outline-none disabled:opacity-60"
        >
          {GATE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Description toggle */}
        <button
          onClick={() => setDescOpen(!descOpen)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Toggle description"
        >
          {descOpen ? '\u2303' : '\u2304'} Desc
        </button>

        {/* Remove phase */}
        {!readOnly && (
          <button
            onClick={() => onRemovePhase(phaseIndex)}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Remove phase"
          >
            x
          </button>
        )}
      </div>

      {/* Phase description */}
      <div
        className={`overflow-hidden transition-all duration-200 px-4 ${
          descOpen ? 'max-h-[200px] py-2' : 'max-h-0'
        }`}
      >
        <textarea
          value={phase.description ?? ''}
          onChange={(e) => updateField({ description: e.target.value || undefined })}
          disabled={readOnly}
          placeholder="Phase description (optional)..."
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 resize-y focus:border-amber-500 focus:outline-none disabled:opacity-60"
        />
      </div>

      {/* Phase-level errors (not from nested tasks) */}
      {getErrorsForPath(validationErrors, basePath)
        .filter((msg) => {
          // Show only errors directly on the phase, not nested task errors
          const taskPrefix = `phases[${phaseIndex}].tasks`;
          return !validationErrors?.some(
            (e) => e.path.startsWith(taskPrefix) && e.message === msg,
          );
        })
        .map((msg, i) => (
          <p key={i} className="text-xs text-red-400 px-4 py-1">{msg}</p>
        ))}

      {/* Tasks */}
      <div className="px-4 py-3 space-y-3">
        {phase.tasks.map((task, taskIndex) => (
          <TaskCardEditor
            key={task.key || `task-${phaseIndex}-${taskIndex}`}
            task={task}
            phaseIndex={phaseIndex}
            taskIndex={taskIndex}
            allTaskKeys={allTaskKeys}
            validationErrors={validationErrors}
            readOnly={readOnly}
            onUpdateTask={onUpdateTask}
            onRemoveTask={onRemoveTask}
          />
        ))}

        {/* Add task button */}
        {!readOnly && (
          <button
            onClick={() => onAddTask(phaseIndex)}
            className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
          >
            + Add Task
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PlanEditor ─────────────────────────────────────────────────────────────

export function PlanEditor({ plan, onChange, validationErrors, readOnly = false }: PlanEditorProps) {
  const [cbOpen, setCbOpen] = useState(false);

  const allTaskKeys = useMemo(() => getAllTaskKeys(plan), [plan]);

  const uniqueAgents = useMemo(() => {
    const agentIds = new Set<string>();
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        if (task.agent_id) agentIds.add(task.agent_id);
      }
    }
    return AGENTS.filter((a) => agentIds.has(a.id));
  }, [plan]);

  const totalTasks = useMemo(() => {
    let count = 0;
    for (const phase of plan.phases) {
      count += phase.tasks.length;
    }
    return count;
  }, [plan]);

  const totalDeps = useMemo(() => {
    let count = 0;
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        count += (task.depends_on ?? []).length;
      }
    }
    return count;
  }, [plan]);

  // ─── Immutable update helpers ─────────────────────────────────────────

  const updatePlanField = useCallback(
    (partial: Partial<PlannerOutput>) => {
      onChange({ ...plan, ...partial });
    },
    [plan, onChange],
  );

  const onUpdatePhase = useCallback(
    (phaseIndex: number, updated: PlannerPhaseOutput) => {
      const newPhases = plan.phases.map((p, i) => (i === phaseIndex ? updated : p));
      onChange({ ...plan, phases: newPhases });
    },
    [plan, onChange],
  );

  const onRemovePhase = useCallback(
    (phaseIndex: number) => {
      const newPhases = plan.phases.filter((_, i) => i !== phaseIndex);
      onChange({ ...plan, phases: newPhases });
    },
    [plan, onChange],
  );

  const onUpdateTask = useCallback(
    (phaseIndex: number, taskIndex: number, updated: PlannerTaskOutput) => {
      const newPhases = plan.phases.map((phase, pi) => {
        if (pi !== phaseIndex) return phase;
        const newTasks = phase.tasks.map((t, ti) => (ti === taskIndex ? updated : t));
        return { ...phase, tasks: newTasks };
      });
      onChange({ ...plan, phases: newPhases });
    },
    [plan, onChange],
  );

  const onRemoveTask = useCallback(
    (phaseIndex: number, taskIndex: number) => {
      const removedKey = plan.phases[phaseIndex]?.tasks[taskIndex]?.key;
      const newPhases = plan.phases.map((phase, pi) => {
        if (pi !== phaseIndex) {
          // Also clean up any depends_on references to the removed task
          if (removedKey) {
            const cleanedTasks = phase.tasks.map((t) => ({
              ...t,
              depends_on: (t.depends_on ?? []).filter((d) => d !== removedKey),
            }));
            return { ...phase, tasks: cleanedTasks };
          }
          return phase;
        }
        const newTasks = phase.tasks.filter((_, ti) => ti !== taskIndex);
        // Clean deps within same phase
        const cleanedTasks = removedKey
          ? newTasks.map((t) => ({
              ...t,
              depends_on: (t.depends_on ?? []).filter((d) => d !== removedKey),
            }))
          : newTasks;
        return { ...phase, tasks: cleanedTasks };
      });
      onChange({ ...plan, phases: newPhases });
    },
    [plan, onChange],
  );

  const onAddTask = useCallback(
    (phaseIndex: number) => {
      const newTask: PlannerTaskOutput = {
        key: `new_task_${Date.now()}`,
        title: '',
        instructions: '',
        agent_id: '',
        priority: 'medium',
        domains: [],
        depends_on: [],
      };
      const newPhases = plan.phases.map((phase, pi) => {
        if (pi !== phaseIndex) return phase;
        return { ...phase, tasks: [...phase.tasks, newTask] };
      });
      onChange({ ...plan, phases: newPhases });
    },
    [plan, onChange],
  );

  const addPhase = () => {
    const newPhase: PlannerPhaseOutput = {
      title: `Phase ${plan.phases.length + 1}`,
      gate_type: 'all_complete',
      tasks: [],
    };
    onChange({ ...plan, phases: [...plan.phases, newPhase] });
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="bg-zinc-950 rounded-lg flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ── Plan Header ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Title */}
          <input
            type="text"
            value={plan.title}
            onChange={(e) => updatePlanField({ title: e.target.value })}
            disabled={readOnly}
            placeholder="Plan title..."
            className={`w-full bg-zinc-800 border rounded px-3 py-2 text-lg font-semibold text-zinc-100 focus:border-amber-500 focus:outline-none disabled:opacity-60 ${
              getErrorsForPath(validationErrors, 'title').length > 0 ? 'border-red-500' : 'border-zinc-700'
            }`}
          />
          {getErrorsForPath(validationErrors, 'title').map((msg, i) => (
            <p key={i} className="text-xs text-red-400">{msg}</p>
          ))}

          {/* Description */}
          <textarea
            value={plan.description ?? ''}
            onChange={(e) => updatePlanField({ description: e.target.value || undefined })}
            disabled={readOnly}
            placeholder="Plan description (optional)..."
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 resize-y focus:border-amber-500 focus:outline-none disabled:opacity-60"
          />

          {/* Circuit breaker */}
          <div>
            <button
              onClick={() => setCbOpen(!cbOpen)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:border-amber-500/40 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {circuitBreakerLabel(plan)}
              <span className="text-[10px] text-zinc-500">{cbOpen ? '\u2303' : '\u2304'}</span>
            </button>

            <div
              className={`overflow-hidden transition-all duration-200 ${
                cbOpen ? 'max-h-[120px] mt-3' : 'max-h-0'
              }`}
            >
              <div className="flex items-center gap-4 p-3 bg-zinc-900 border border-zinc-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500">On task failure</label>
                  <select
                    value={plan.circuit_breaker?.on_task_failure ?? 'stop_phase'}
                    onChange={(e) =>
                      updatePlanField({
                        circuit_breaker: {
                          ...(plan.circuit_breaker ?? { max_phase_failures: 2 }),
                          on_task_failure: e.target.value as FailurePolicy,
                        },
                      })
                    }
                    disabled={readOnly}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                  >
                    {FAILURE_POLICY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500">Max failures</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={plan.circuit_breaker?.max_phase_failures ?? 2}
                    onChange={(e) =>
                      updatePlanField({
                        circuit_breaker: {
                          ...(plan.circuit_breaker ?? { on_task_failure: 'stop_phase' as FailurePolicy }),
                          max_phase_failures: parseInt(e.target.value) || 2,
                        },
                      })
                    }
                    disabled={readOnly}
                    className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Phase Sections ──────────────────────────────────────────── */}
        <div className="space-y-4">
          {plan.phases.map((phase, phaseIndex) => (
            <PhaseSection
              key={`phase-${phaseIndex}`}
              phase={phase}
              phaseIndex={phaseIndex}
              allTaskKeys={allTaskKeys}
              validationErrors={validationErrors}
              readOnly={readOnly}
              onUpdatePhase={onUpdatePhase}
              onRemovePhase={onRemovePhase}
              onUpdateTask={onUpdateTask}
              onRemoveTask={onRemoveTask}
              onAddTask={onAddTask}
            />
          ))}
        </div>

        {/* ── Add Phase ───────────────────────────────────────────────── */}
        {!readOnly && (
          <button
            onClick={addPhase}
            className="w-full py-3 border border-dashed border-zinc-700 rounded-lg text-sm text-zinc-500 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
          >
            + Add Phase
          </button>
        )}
      </div>

      {/* ── Summary Bar (sticky bottom) ──────────────────────────────── */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-sm px-4 py-2.5 flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Phases</span>
          <span className="text-xs font-medium text-zinc-200">{plan.phases.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Tasks</span>
          <span className="text-xs font-medium text-zinc-200">{totalTasks}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Dependencies</span>
          <span className="text-xs font-medium text-zinc-200">{totalDeps}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-zinc-500">Agents</span>
          <div className="flex -space-x-1.5">
            {uniqueAgents.slice(0, 8).map((agent) => (
              <div
                key={agent.id}
                className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center"
                title={`${agent.emoji} ${agent.name}`}
              >
                <span className="text-xs">{agent.emoji}</span>
              </div>
            ))}
            {uniqueAgents.length > 8 && (
              <div className="w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center">
                <span className="text-[10px] text-zinc-300">+{uniqueAgents.length - 8}</span>
              </div>
            )}
          </div>
        </div>

        {/* Validation error count */}
        {validationErrors && validationErrors.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-red-300">
              {validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
