import type { AgentFull, OnboardingStep } from '../../../types/supabase';
import { cn } from '../../../lib/utils';

interface WizardStepOnboardingProps {
  agent: AgentFull;
  onComplete: (agent: AgentFull) => void;
  onSkip: (agent: AgentFull) => void;
  onBack: () => void;
}

const CHECKLIST_ITEMS: Array<{
  step: OnboardingStep;
  label: string;
  auto: boolean;
  required: boolean;
  buttonLabel?: string;
}> = [
  { step: 'soul_review', label: 'SOUL profile reviewed and approved', auto: true, required: true },
  { step: 'avatar_set', label: 'Avatar configured', auto: true, required: true },
  { step: 'team_assigned', label: 'Assigned to team', auto: true, required: true },
  { step: 'intro_message_sent', label: 'Send team introduction', auto: false, required: true, buttonLabel: 'Send Now' },
  { step: 'first_task_assigned', label: 'Assign first task', auto: false, required: false, buttonLabel: 'Create Task' },
  { step: 'workflow_configured', label: 'Configure workflows', auto: false, required: false, buttonLabel: 'Configure' },
];

export function WizardStepOnboarding({
  agent,
  onComplete,
  onSkip,
  onBack,
}: WizardStepOnboardingProps) {
  // Auto-mark steps that should already be complete
  const checklist = CHECKLIST_ITEMS.map((item) => {
    const existing = agent.onboardingChecklist.find((c) => c.step === item.step);
    const isAutoComplete = item.auto;
    return {
      ...item,
      completed: existing?.completed ?? isAutoComplete,
      completedAt: existing?.completedAt ?? (isAutoComplete ? new Date().toISOString() : null),
    };
  });

  const completedCount = checklist.filter((c) => c.completed).length;
  const totalCount = checklist.length;
  const progress = Math.round((completedCount / totalCount) * 100);
  const requiredDone = checklist.filter((c) => c.required).every((c) => c.completed);

  const handleStepAction = (step: OnboardingStep) => {
    // Simulate completing the step
    const updatedChecklist = agent.onboardingChecklist.map((item) =>
      item.step === step
        ? { ...item, completed: true, completedAt: new Date().toISOString() }
        : item
    );
    // If the step wasn't in the checklist, add it
    if (!updatedChecklist.some((c) => c.step === step)) {
      updatedChecklist.push({
        step,
        label: CHECKLIST_ITEMS.find((c) => c.step === step)?.label ?? step,
        completed: true,
        completedAt: new Date().toISOString(),
      });
    }
    // We don't call onComplete here; the parent wizard will re-render with updated state
  };

  const finalizeAgent = (): AgentFull => ({
    ...agent,
    lifecycleStatus: 'active',
    onboardedAt: new Date().toISOString(),
    onboardingChecklist: checklist.map((c) => ({
      step: c.step,
      label: c.label,
      completed: c.completed,
      completedAt: c.completedAt,
    })),
  });

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">
          Onboarding: {agent.emoji} {agent.name}
        </h3>
        <p className="text-sm text-zinc-500">
          Complete the checklist to activate your new agent.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">Progress</span>
          <span className="text-xs text-zinc-400">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2 mb-8">
        {checklist.map((item) => (
          <div
            key={item.step}
            className={cn(
              'flex items-center justify-between px-4 py-3 rounded-lg border',
              item.completed
                ? 'border-zinc-800 bg-zinc-800/30'
                : 'border-zinc-700 bg-zinc-800/50'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  item.completed
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-zinc-600'
                )}
              >
                {item.completed && (
                  <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span
                className={cn(
                  'text-sm',
                  item.completed ? 'text-zinc-500 line-through' : 'text-zinc-300'
                )}
              >
                {item.label}
                {!item.required && <span className="text-zinc-600 ml-1">(optional)</span>}
              </span>
            </div>
            {!item.completed && item.buttonLabel && (
              <button
                onClick={() => handleStepAction(item.step)}
                className="px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-600 transition-colors"
              >
                {item.buttonLabel}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => onSkip(finalizeAgent())}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip Onboarding
          </button>
          <button
            onClick={() => onComplete(finalizeAgent())}
            disabled={!requiredDone}
            className="px-6 py-2.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Complete Onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
