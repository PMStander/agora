import { useRef, useState } from 'react';
import { runAgentPrompt } from '../../lib/agentRun';
import {
  parsePlannerOutput,
  validatePlannerOutput,
  normalizePlanToRows,
} from '../../lib/planParser';
import type { PlanValidationError } from '../../lib/planParser';
import type { PlannerOutput, NormalizedPlanRows } from '../../types/missionPlan';
import { useMissionControlStore } from '../../stores/missionControl';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionPlan } from '../../hooks/useMissionPlan';
import { activatePlan } from '../../lib/planEngine';
import { supabase } from '../../lib/supabase';
import { AGENTS } from '../../types/supabase';
import type { MissionPriority } from '../../types/supabase';
import { PlanEditor } from './PlanEditor';

const STEPS = ['Brief', 'Strategy', 'Plan', 'Execute'] as const;
const MAIN_AGENT_ID = 'main';
const SESSION_NAMESPACE = 'operation-wizard';

type WizardStatus =
  | 'idle'
  | 'generating_strategy'
  | 'strategy_ready'
  | 'revising_strategy'
  | 'generating_plan'
  | 'plan_ready'
  | 'plan_error'
  | 'executing'
  | 'done'
  | 'error';

// ─── Prompt Builders ─────────────────────────────────────────────────────────

function buildStrategyConsultPrompt(briefText: string, priority: string): string {
  return [
    'You are contributing specialist insight for an operation strategy.',
    `User brief: ${briefText}`,
    `Priority: ${priority}`,
    'Provide: key approach, risks, resource needs, timeline estimate.',
  ].join('\n');
}

function buildMainStrategyPrompt(
  briefText: string,
  priority: string,
  collaboratorNotes: string
): string {
  return [
    'Create a comprehensive operation strategy document.',
    `User brief: ${briefText}`,
    `Priority: ${priority}`,
    `Specialist insights:\n${collaboratorNotes || '(none)'}`,
    '',
    'Return markdown with these sections:',
    '1. Executive Summary',
    '2. Approach',
    '3. Phases Overview',
    '4. Resource Allocation',
    '5. Risk Mitigation',
    '6. Timeline',
    '7. Success Metrics',
  ].join('\n');
}

function buildStrategyRevisionPrompt(
  currentStrategy: string,
  feedback: string
): string {
  return [
    'Revise the operation strategy using the user feedback.',
    'Keep the same section structure and improve precision.',
    '',
    `Current strategy:\n${currentStrategy}`,
    '',
    `User feedback:\n${feedback}`,
    '',
    'Return the full revised strategy in markdown.',
  ].join('\n');
}

function buildPlannerPrompt(
  strategyMarkdown: string,
  agents: Array<{ id: string; name: string }>
): string {
  const agentJson = JSON.stringify(agents.map((a) => ({ id: a.id, name: a.name })));
  const agentIds = agents.map((a) => a.id).join(', ');
  return [
    'Create a detailed execution plan from this strategy.',
    `Strategy:\n${strategyMarkdown}`,
    `Available agents: ${agentJson}`,
    '',
    'Return ONLY valid JSON matching this exact shape:',
    '{"title":"...", "description":"...", "circuit_breaker":{"on_task_failure":"stop_phase","max_phase_failures":2}, "phases":[{"title":"...", "description":"...", "gate_type":"all_complete", "tasks":[{"key":"unique-key", "title":"...", "instructions":"...", "agent_id":"...", "priority":"medium", "domains":[], "depends_on":[], "informs":[], "review_enabled":false, "review_agent_id":null, "max_revisions":1}]}]}',
    '',
    `Rules: use only these agent IDs: ${agentIds}. Each task must have unique key. Set depends_on for task ordering.`,
  ].join('\n');
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-400">
      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  );
}

// ─── Agent name lookup ───────────────────────────────────────────────────────

function agentLabel(agentId: string): string {
  const agent = AGENTS.find((a) => a.id === agentId);
  return agent ? `${agent.emoji} ${agent.name}` : agentId;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LaunchOperationWizard() {
  const { isOperationWizardOpen, setOperationWizardOpen } = useMissionControlStore();
  const addActivity = useMissionControlStore((s) => s.addActivity);
  const requestSchedulerTick = useMissionControlStore((s) => s.requestSchedulerTick);
  const { agents, createMission } = useMissionControl();

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Brief
  const [briefText, setBriefText] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [priority, setPriority] = useState<MissionPriority>('medium');
  const [mediaFiles, setMediaFiles] = useState<Array<{ url: string; type: string; name: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Strategy
  const [strategyMarkdown, setStrategyMarkdown] = useState('');
  const [strategyFeedback, setStrategyFeedback] = useState('');

  // Step 3: Plan
  const [parsedPlan, setParsedPlan] = useState<PlannerOutput | null>(null);
  const [validationErrors, setValidationErrors] = useState<PlanValidationError[]>([]);
  const [normalizedRows, setNormalizedRows] = useState<NormalizedPlanRows | null>(null);

  // Step 4: Execute
  const [createdMissionId, setCreatedMissionId] = useState<string | null>(null);
  const { createPlan: createPlanInDb } = useMissionPlan(createdMissionId);

  // Wizard-wide state
  const [wizardStatus, setWizardStatus] = useState<WizardStatus>('idle');
  const [wizardError, setWizardError] = useState<string | null>(null);

  if (!isOperationWizardOpen) return null;

  const collaboratorAgents = agents.filter((a: { id: string }) => a.id !== MAIN_AGENT_ID);
  const isBusy =
    wizardStatus === 'generating_strategy' ||
    wizardStatus === 'revising_strategy' ||
    wizardStatus === 'generating_plan' ||
    wizardStatus === 'executing';

  const resetAndClose = () => {
    setCurrentStep(0);
    setBriefText('');
    setSelectedAgents([]);
    setPriority('medium');
    setMediaFiles([]);
    setStrategyMarkdown('');
    setStrategyFeedback('');
    setParsedPlan(null);
    setValidationErrors([]);
    setNormalizedRows(null);
    setCreatedMissionId(null);
    setWizardStatus('idle');
    setWizardError(null);
    setOperationWizardOpen(false);
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
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

  // ─── Step 1 → Step 2: Generate Strategy ──────────────────────────────────

  const generateStrategy = async () => {
    if (!briefText.trim()) return;
    setWizardStatus('generating_strategy');
    setWizardError(null);
    setStrategyMarkdown('');
    setCurrentStep(1);

    addActivity({
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'strategy_generating',
      message: 'Operation strategy generation started',
      agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
      created_at: new Date().toISOString(),
    });

    try {
      // 1. Consult selected collaborator agents in parallel
      const collaboratorResults = await Promise.allSettled(
        selectedAgents.map(async (agentId) => {
          const response = await runAgentPrompt(
            agentId,
            buildStrategyConsultPrompt(briefText, priority),
            { sessionNamespace: SESSION_NAMESPACE }
          );
          return { agentId, text: response.text };
        })
      );

      const collaboratorNotes = collaboratorResults
        .map((result) => {
          if (result.status === 'rejected') return '';
          const agent = AGENTS.find((a) => a.id === result.value.agentId);
          const label = agent ? `${agent.emoji} ${agent.name}` : result.value.agentId;
          return `${label}:\n${result.value.text}`;
        })
        .filter(Boolean)
        .join('\n\n');

      // 2. Send combined insights to main agent for strategy draft
      const strategyResult = await runAgentPrompt(
        MAIN_AGENT_ID,
        buildMainStrategyPrompt(briefText, priority, collaboratorNotes),
        {
          sessionNamespace: SESSION_NAMESPACE,
          onDelta: setStrategyMarkdown,
        }
      );

      setStrategyMarkdown(strategyResult.text);
      setWizardStatus('strategy_ready');

      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'strategy_ready',
        message: 'Operation strategy generated and ready for review',
        agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setWizardStatus('error');
      setWizardError(String(err));
    }
  };

  // ─── Revise Strategy ─────────────────────────────────────────────────────

  const reviseStrategy = async () => {
    if (!strategyMarkdown.trim() || !strategyFeedback.trim()) return;
    setWizardStatus('revising_strategy');
    setWizardError(null);

    try {
      const revised = await runAgentPrompt(
        MAIN_AGENT_ID,
        buildStrategyRevisionPrompt(strategyMarkdown, strategyFeedback),
        {
          sessionNamespace: SESSION_NAMESPACE,
          onDelta: setStrategyMarkdown,
        }
      );

      setStrategyMarkdown(revised.text);
      setStrategyFeedback('');
      setWizardStatus('strategy_ready');

      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'strategy_revised',
        message: 'Operation strategy revised based on feedback',
        agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setWizardStatus('error');
      setWizardError(String(err));
    }
  };

  // ─── Step 2 → Step 3: Generate Plan ──────────────────────────────────────

  const generatePlan = async () => {
    if (!strategyMarkdown.trim()) return;
    setWizardStatus('generating_plan');
    setWizardError(null);
    setParsedPlan(null);
    setValidationErrors([]);
    setNormalizedRows(null);
    setCurrentStep(2);

    addActivity({
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'plan_generating',
      message: 'Execution plan generation started',
      agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
      created_at: new Date().toISOString(),
    });

    try {
      const planResult = await runAgentPrompt(
        MAIN_AGENT_ID,
        buildPlannerPrompt(strategyMarkdown, agents),
        { sessionNamespace: SESSION_NAMESPACE }
      );

      const parsed = parsePlannerOutput(planResult.text);
      if (!parsed) {
        setWizardStatus('plan_error');
        setWizardError('Failed to parse plan output. The agent did not return valid JSON.');
        return;
      }

      const validation = validatePlannerOutput(parsed);
      if (!validation.valid) {
        setParsedPlan(parsed);
        setValidationErrors(validation.errors);
        setWizardStatus('plan_error');
        setWizardError(`Plan has ${validation.errors.length} validation error(s).`);
        return;
      }

      setParsedPlan(parsed);
      setValidationErrors([]);
      setWizardStatus('plan_ready');

      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'plan_ready',
        message: `Execution plan ready: ${parsed.phases.length} phases, ${parsed.phases.reduce((sum, p) => sum + (p.tasks?.length || 0), 0)} tasks`,
        agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setWizardStatus('error');
      setWizardError(String(err));
    }
  };

  // ─── Step 3 → Step 4: Execute ─────────────────────────────────────────────

  const approvePlanAndExecute = async () => {
    if (!parsedPlan) return;
    setWizardStatus('executing');
    setWizardError(null);
    setCurrentStep(3);

    try {
      // 1. Create the parent mission
      const mission = await createMission({
        title: parsedPlan.title,
        description: parsedPlan.description || briefText,
        input_text: briefText,
        input_media: mediaFiles,
        agent_id: MAIN_AGENT_ID,
        priority,
        status: 'assigned',
        mission_status: 'assigned',
        scheduled_at: new Date().toISOString(),
        mission_statement: strategyMarkdown,
        mission_plan: JSON.stringify(parsedPlan),
        mission_phase: 'plan',
        mission_phase_status: 'approved',
      });

      if (!mission) {
        throw new Error('Failed to create parent mission in Supabase.');
      }

      // 2. Normalize plan to DB rows
      const rows = normalizePlanToRows(parsedPlan, mission.id, 1, 'operation-wizard');
      setNormalizedRows(rows);
      setCreatedMissionId(mission.id);

      // 3. Create plan in database (phases, tasks, edges)
      const createdPlan = await createPlanInDb(rows);
      if (!createdPlan) {
        throw new Error('Failed to create plan in database.');
      }

      // 4. Fetch the created phases, tasks, and edges from the plan
      const { data: phases, error: phasesError } = await supabase
        .from('plan_phases')
        .select('*')
        .eq('plan_id', createdPlan.id)
        .order('phase_order', { ascending: true });
      
      if (phasesError) throw phasesError;

      const { data: tasks, error: tasksError } = await supabase
        .from('plan_tasks')
        .select('*')
        .eq('plan_id', createdPlan.id);
      
      if (tasksError) throw tasksError;

      const { data: edges, error: edgesError } = await supabase
        .from('plan_task_edges')
        .select('*')
        .eq('plan_id', createdPlan.id);
      
      if (edgesError) throw edgesError;

      // Convert DB rows to TypeScript types (matching planEngine expectations)
      const tsPhases = phases.map((p) => ({
        ...p,
        phase_index: p.phase_order,
      }));

      const tsTasks = tasks.map((t) => ({
        ...t,
        key: t.task_key,
      }));

      const tsEdges = edges.map((e) => ({
        ...e,
        source_task_id: e.from_task_id,
        target_task_id: e.to_task_id,
      }));

      // 5. Activate the plan (mark phase 0 as active, unblocked tasks as ready)
      const { phaseUpdates, taskUpdates } = activatePlan(tsPhases, tsTasks, tsEdges);

      // 6. Apply phase activation updates to database
      for (const phaseUpdate of phaseUpdates) {
        const { error: phaseUpdateError } = await supabase
          .from('plan_phases')
          .update({
            status: phaseUpdate.status,
            started_at: phaseUpdate.started_at,
            updated_at: phaseUpdate.started_at,
          })
          .eq('id', phaseUpdate.id);
        
        if (phaseUpdateError) throw phaseUpdateError;
      }

      // 7. Apply task readiness updates to database
      for (const taskUpdate of taskUpdates) {
        const { error: taskUpdateError } = await supabase
          .from('plan_tasks')
          .update({
            status: taskUpdate.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskUpdate.id);
        
        if (taskUpdateError) throw taskUpdateError;
      }

      requestSchedulerTick();
      setWizardStatus('done');

      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'operation_launched',
        message: `Operation "${parsedPlan.title}" launched with ${rows.phases.length} phases and ${rows.tasks.length} tasks. Plan activated.`,
        agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setWizardStatus('error');
      setWizardError(String(err));
    }
  };

  // ─── Navigation helpers ───────────────────────────────────────────────────

  const canGoNext = () => {
    if (currentStep === 0) return briefText.trim().length > 0;
    if (currentStep === 1) return wizardStatus === 'strategy_ready';
    if (currentStep === 2) return wizardStatus === 'plan_ready';
    return false;
  };

  const goBack = () => {
    if (isBusy) return;
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // ─── Step-specific action for "Next" in bottom bar ────────────────────────

  const handleNext = () => {
    if (currentStep === 0) {
      generateStrategy();
    } else if (currentStep === 1) {
      generatePlan();
    } else if (currentStep === 2) {
      approvePlanAndExecute();
    }
  };

  // ─── Priority options ─────────────────────────────────────────────────────

  const priorityOptions: { value: MissionPriority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'text-zinc-400' },
    { value: 'medium', label: 'Medium', color: 'text-blue-400' },
    { value: 'high', label: 'High', color: 'text-orange-400' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-400' },
  ];

  // ─── Plan summary helpers ─────────────────────────────────────────────────

  const uniqueAgentIds = parsedPlan
    ? [...new Set(parsedPlan.phases.flatMap((p) => (p.tasks || []).map((t) => t.agent_id)))]
    : [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-lg">🚀</span>
          <h1 className="text-lg font-semibold text-zinc-100">Launch Operation</h1>
        </div>
        <button
          onClick={resetAndClose}
          disabled={isBusy}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1 px-6 py-4 bg-zinc-900/50 border-b border-zinc-800">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <div key={step} className="flex items-center">
              {index > 0 && (
                <div
                  className={`w-12 h-px mx-2 ${
                    isCompleted ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-black border-amber-500'
                      : isCompleted
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive
                      ? 'text-amber-300'
                      : isCompleted
                        ? 'text-amber-400/70'
                        : 'text-zinc-500'
                  }`}
                >
                  {step}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Step 1: Brief */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100 mb-1">Operation Brief</h2>
                <p className="text-sm text-zinc-500">
                  Describe the outcome you want. Be specific about constraints, timeline, and non-negotiables.
                </p>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">What do you want to achieve?</label>
                <textarea
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  rows={8}
                  placeholder="Describe the desired outcome, constraints, timeline, and non-negotiables..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Assign Agents</label>
                <div className="flex flex-wrap gap-2">
                  {collaboratorAgents.map((agent: { id: string; name: string; emoji: string; role?: string }) => {
                    const selected = selectedAgents.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => toggleAgent(agent.id)}
                        title={agent.role}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
                          selected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        <span>{agent.emoji}</span>
                        {agent.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Priority</label>
                <div className="flex items-center gap-4">
                  {priorityOptions.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="op-priority"
                        checked={priority === opt.value}
                        onChange={() => setPriority(opt.value)}
                        className="accent-amber-500"
                      />
                      <span className={`text-sm ${opt.color}`}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Attachments</label>
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

              <button
                type="button"
                onClick={generateStrategy}
                disabled={!briefText.trim() || isBusy}
                className="px-5 py-2.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Generate Strategy →
              </button>
            </div>
          )}

          {/* Step 2: Strategy */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100 mb-1">Strategy Review</h2>
                <p className="text-sm text-zinc-500">
                  Review the AI-generated strategy. Provide feedback or approve to proceed.
                </p>
              </div>

              {/* Status bar */}
              {(wizardStatus === 'generating_strategy' || wizardStatus === 'revising_strategy') && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <Spinner
                    label={
                      wizardStatus === 'generating_strategy'
                        ? 'Consulting agents and generating strategy...'
                        : 'Revising strategy based on your feedback...'
                    }
                  />
                </div>
              )}

              {wizardError && currentStep === 1 && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {wizardError}
                  <button
                    type="button"
                    onClick={generateStrategy}
                    className="ml-3 text-red-200 underline hover:text-red-100"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {/* Left: Strategy preview */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Generated Strategy</label>
                  <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 min-h-[300px] max-h-[500px] overflow-y-auto">
                    {strategyMarkdown ? (
                      <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-mono">
                        {strategyMarkdown}
                      </pre>
                    ) : (
                      <div className="flex items-center justify-center h-full min-h-[300px] text-zinc-600 text-sm">
                        {wizardStatus === 'generating_strategy'
                          ? 'Strategy is being generated...'
                          : 'Strategy will appear here after generation.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Feedback */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Your Feedback</label>
                  <textarea
                    value={strategyFeedback}
                    onChange={(e) => setStrategyFeedback(e.target.value)}
                    rows={12}
                    placeholder="What would you change about this strategy?"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none text-sm"
                    disabled={isBusy}
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={reviseStrategy}
                      disabled={!strategyFeedback.trim() || isBusy || !strategyMarkdown.trim()}
                      className="px-4 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Revise
                    </button>
                    <button
                      type="button"
                      onClick={generatePlan}
                      disabled={isBusy || wizardStatus !== 'strategy_ready'}
                      className="px-4 py-2 text-sm bg-emerald-500 text-black font-medium rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Approve Strategy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Plan */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100 mb-1">Execution Plan</h2>
                <p className="text-sm text-zinc-500">
                  Review and adjust the generated plan before execution.
                </p>
              </div>

              {/* Status bar */}
              {wizardStatus === 'generating_plan' && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <Spinner label="Generating execution plan from strategy..." />
                </div>
              )}

              {wizardError && (wizardStatus === 'plan_error' || (wizardStatus === 'error' && currentStep === 2)) && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
                  <div>{wizardError}</div>
                  {validationErrors.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <div className="text-red-400 font-medium">Validation errors:</div>
                      {validationErrors.map((err, i) => (
                        <div key={i} className="text-red-300/80">
                          <span className="text-red-400 font-mono">{err.path}</span>: {err.message}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={generatePlan}
                    className="text-red-200 underline hover:text-red-100"
                  >
                    Retry plan generation
                  </button>
                </div>
              )}

              {parsedPlan ? (
                <PlanEditor
                  plan={parsedPlan}
                  onChange={setParsedPlan}
                  validationErrors={validationErrors}
                  readOnly={wizardStatus === 'executing' || wizardStatus === 'done'}
                />
              ) : wizardStatus === 'generating_plan' ? (
                <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-6 min-h-[400px] flex items-center justify-center text-zinc-600 text-sm">
                  Plan is being generated...
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-6 min-h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-3 opacity-30">🗺️</div>
                    <p className="text-zinc-500 text-sm">Plan will appear here after strategy approval.</p>
                  </div>
                </div>
              )}

              {wizardStatus === 'plan_ready' && parsedPlan && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={generatePlan}
                    className="px-4 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 transition-colors"
                  >
                    Regenerate Plan
                  </button>
                  <button
                    type="button"
                    onClick={approvePlanAndExecute}
                    disabled={isBusy}
                    className="px-5 py-2.5 text-sm bg-emerald-500 text-black font-medium rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Approve Plan & Execute
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Execute */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100 mb-1">Operation Launched</h2>
                <p className="text-sm text-zinc-500">
                  Your operation has been created and is ready for execution.
                </p>
              </div>

              {wizardStatus === 'executing' && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <Spinner label="Creating mission and setting up execution..." />
                </div>
              )}

              {wizardError && currentStep === 3 && (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  {wizardError}
                  <button
                    type="button"
                    onClick={approvePlanAndExecute}
                    className="ml-3 text-red-200 underline hover:text-red-100"
                  >
                    Retry
                  </button>
                </div>
              )}

              {wizardStatus === 'done' && parsedPlan && normalizedRows && (
                <div className="space-y-4">
                  {/* Success banner */}
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 text-emerald-300 font-medium text-sm mb-2">
                      <span>✓</span> Operation created successfully
                    </div>
                    <div className="text-xs text-emerald-200/70">
                      Mission ID: {createdMissionId}
                    </div>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-zinc-100">{parsedPlan.title.length > 20 ? '📋' : parsedPlan.title}</div>
                      <div className="text-xs text-zinc-500 mt-1">Mission</div>
                      <div className="text-sm text-zinc-300 mt-1 truncate">{parsedPlan.title}</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-400">{normalizedRows.phases.length}</div>
                      <div className="text-xs text-zinc-500 mt-1">Phases</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-400">{normalizedRows.tasks.length}</div>
                      <div className="text-xs text-zinc-500 mt-1">Tasks</div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-purple-400">{uniqueAgentIds.length}</div>
                      <div className="text-xs text-zinc-500 mt-1">Agents</div>
                    </div>
                  </div>

                  {/* Agent assignments */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Agent Assignments</div>
                    <div className="flex flex-wrap gap-3">
                      {uniqueAgentIds.map((agentId) => {
                        const taskCount = normalizedRows.tasks.filter((t) => t.agent_id === agentId).length;
                        return (
                          <div
                            key={agentId}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
                          >
                            <span className="text-sm">{agentLabel(agentId)}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                              {taskCount} task{taskCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Phase breakdown */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Phase Breakdown</div>
                    <div className="space-y-2">
                      {normalizedRows.phases.map((phase, i) => {
                        const phaseTasks = normalizedRows.tasks.filter((t) => t.phase_id === `phase_${i}`);
                        return (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-zinc-500">P{i + 1}</span>
                              <span className="text-sm text-zinc-300">{phase.title}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                              <span>{phaseTasks.length} task{phaseTasks.length !== 1 ? 's' : ''}</span>
                              <span className="px-1.5 py-0.5 rounded bg-zinc-700">{phase.gate_type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900">
        <button
          type="button"
          onClick={currentStep === 0 ? resetAndClose : goBack}
          disabled={isBusy}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
        >
          {currentStep === 0 ? 'Cancel' : '← Back'}
        </button>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === currentStep
                  ? 'bg-amber-500'
                  : index < currentStep
                    ? 'bg-amber-500/40'
                    : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {currentStep < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext() || isBusy}
            className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {currentStep === 0
              ? 'Generate Strategy →'
              : currentStep === 1
                ? 'Approve & Generate Plan →'
                : 'Approve Plan & Execute →'}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetAndClose}
            disabled={isBusy}
            className="px-5 py-2 text-sm bg-emerald-500 text-black font-medium rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
