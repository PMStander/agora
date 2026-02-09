import { useAgentStore } from '../../stores/agents';
import { useHiringWizardStore, type HiringWizardStep } from '../../stores/agentHiring';
import { useAgentHiring } from '../../hooks/useAgentHiring';
import { WizardStepRole } from './wizard/WizardStepRole';
import { WizardStepSoulBuilder } from './wizard/WizardStepSoulBuilder';
import { WizardStepCandidates } from './wizard/WizardStepCandidates';
import { WizardStepRefinement } from './wizard/WizardStepRefinement';
import { WizardStepOnboarding } from './wizard/WizardStepOnboarding';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import type { AgentFull, OnboardingChecklistItem, SoulProfile, HiringRoleSpec } from '../../types/supabase';

const STEPS: { id: HiringWizardStep; label: string; number: number }[] = [
  { id: 'role', label: 'Role', number: 1 },
  { id: 'soul_builder', label: 'Build Soul', number: 2 },
  { id: 'candidates', label: 'Candidates', number: 3 },
  { id: 'refinement', label: 'Refine', number: 4 },
  { id: 'onboarding', label: 'Onboard', number: 5 },
];

function stepIndex(step: HiringWizardStep): number {
  return STEPS.findIndex((s) => s.id === step);
}

/** Generate 3 mock candidates from a role spec and draft soul. */
function generateMockCandidates(spec: HiringRoleSpec, draftSoul: SoulProfile | null): AgentFull[] {
  const base = {
    role: spec.roleTitle,
    team: spec.team,
    avatar: '/avatars/default.png',
    persona: spec.specialization,
    lifecycleStatus: 'candidate' as const,
    domains: spec.domains.map((d) => ({ domain: d, depth: 'intermediate' as const })),
    skills: [],
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    hiredAt: null,
    onboardedAt: null,
    retiredAt: null,
    onboardingChecklist: defaultOnboardingChecklist(),
    createdBy: 'user' as const,
    soulVersion: 1,
  };

  const names = [
    { name: spec.archetype ?? 'Athena', emoji: '🦉' },
    { name: 'Prometheus', emoji: '🔥' },
    { name: 'Hermes', emoji: '⚡' },
  ];

  return names.map((n, i) => ({
    ...base,
    id: crypto.randomUUID(),
    name: n.name,
    emoji: n.emoji,
    soul: {
      origin: draftSoul?.origin || `A ${['methodical', 'creative', 'pragmatic'][i]} ${spec.roleTitle} who excels at ${spec.specialization || spec.domains.join(', ')}.`,
      philosophy: draftSoul?.philosophy.length
        ? draftSoul.philosophy
        : [
            ['Analyze before acting', 'Data drives decisions', 'Precision matters'][i],
            ['Structured approach to every problem', 'Creativity within constraints', 'Results over process'][i],
          ],
      inspirations: draftSoul?.inspirations.length
        ? draftSoul.inspirations
        : [{ name: ['Aristotle', 'Da Vinci', 'Alexander'][i], relationship: 'Primary influence' }],
      communicationStyle: {
        tone: draftSoul?.communicationStyle.tone || ['Precise and analytical', 'Warm and narrative', 'Direct and action-oriented'][i],
        formality: (['formal', 'balanced', 'casual'] as const)[i],
        verbosity: (['thorough', 'balanced', 'concise'] as const)[i],
        quirks: draftSoul?.communicationStyle.quirks.length
          ? draftSoul.communicationStyle.quirks
          : [['Uses data references', 'Tells stories to illustrate points', 'Uses bullet points'][i]],
      },
      neverDos: draftSoul?.neverDos.length
        ? draftSoul.neverDos
        : [['Never act without data', 'Never be boring', 'Never waste time'][i]],
      preferredWorkflows: draftSoul?.preferredWorkflows.length
        ? draftSoul.preferredWorkflows
        : [['Structured analysis', 'Creative brainstorming', 'Rapid prototyping'][i]],
      additionalNotes: null,
    },
  }));
}

function defaultOnboardingChecklist(): OnboardingChecklistItem[] {
  return [
    { step: 'soul_review', label: 'SOUL profile reviewed', completed: true, completedAt: new Date().toISOString() },
    { step: 'avatar_set', label: 'Avatar configured', completed: true, completedAt: new Date().toISOString() },
    { step: 'team_assigned', label: 'Team assigned', completed: true, completedAt: new Date().toISOString() },
    { step: 'intro_message_sent', label: 'Introduction sent', completed: false, completedAt: null },
    { step: 'first_task_assigned', label: 'First task assigned', completed: false, completedAt: null },
    { step: 'workflow_configured', label: 'Workflows configured', completed: false, completedAt: null },
  ];
}

export function HireAgentWizard() {
  const isOpen = useAgentStore((s) => s.isHiringWizardOpen);
  const closeWizard = useAgentStore((s) => s.closeHiringWizard);

  const wizard = useHiringWizardStore();
  const { createAgent } = useAgentHiring();
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    wizard.reset();
    closeWizard();
  };

  const currentIdx = stepIndex(wizard.currentStep);

  const handleRoleNext = (spec: HiringRoleSpec) => {
    wizard.setRoleSpec(spec);
    wizard.setStep('soul_builder');
  };

  const handleSoulBuilderNext = (soul: SoulProfile) => {
    wizard.setDraftSoul(soul);
    // Generate candidates
    setIsGenerating(true);
    wizard.setStep('candidates');
    setTimeout(() => {
      const candidates = generateMockCandidates(wizard.roleSpec!, soul);
      wizard.setCandidates(candidates);
      setIsGenerating(false);
    }, 1500);
  };

  const handleAutoGenerate = () => {
    if (!wizard.roleSpec) return;
    wizard.setStep('candidates');
    setIsGenerating(true);
    setTimeout(() => {
      const candidates = generateMockCandidates(wizard.roleSpec!, null);
      wizard.setCandidates(candidates);
      setIsGenerating(false);
    }, 1500);
  };

  const handleCandidateNext = () => {
    if (wizard.selectedCandidateIndex === null) return;
    const selected = wizard.candidates[wizard.selectedCandidateIndex];
    wizard.setFinalAgent(selected);
    wizard.setStep('refinement');
  };

  const handleRefinementNext = (agent: AgentFull) => {
    wizard.setFinalAgent(agent);
    wizard.setStep('onboarding');
  };

  const handleOnboardingComplete = async (agent: AgentFull) => {
    await createAgent(agent);
    handleClose();
  };

  const handleOnboardingSkip = async (agent: AgentFull) => {
    const skippedAgent: AgentFull = {
      ...agent,
      lifecycleStatus: 'active',
      onboardedAt: new Date().toISOString(),
    };
    await createAgent(skippedAgent);
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with step indicator */}
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-100">Hire New Agent</h2>
            <button
              onClick={handleClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      'w-8 h-px mx-1',
                      i <= currentIdx ? 'bg-amber-500' : 'bg-zinc-700'
                    )}
                  />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                      i < currentIdx
                        ? 'bg-amber-500 text-black'
                        : i === currentIdx
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    )}
                  >
                    {i < currentIdx ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs hidden sm:block',
                      i === currentIdx ? 'text-amber-400' : 'text-zinc-500'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {wizard.currentStep === 'role' && (
            <WizardStepRole
              initialSpec={wizard.roleSpec}
              onNext={handleRoleNext}
            />
          )}

          {wizard.currentStep === 'soul_builder' && (
            <WizardStepSoulBuilder
              messages={wizard.soulBuilderMessages}
              onAddMessage={wizard.addSoulBuilderMessage}
              onAutoGenerate={handleAutoGenerate}
              onNext={handleSoulBuilderNext}
              onBack={() => wizard.setStep('role')}
            />
          )}

          {wizard.currentStep === 'candidates' && (
            <WizardStepCandidates
              candidates={wizard.candidates}
              selectedIndex={wizard.selectedCandidateIndex}
              onSelect={wizard.selectCandidate}
              onNext={handleCandidateNext}
              onBack={() => wizard.setStep('soul_builder')}
              isGenerating={isGenerating}
            />
          )}

          {wizard.currentStep === 'refinement' && wizard.finalAgent && (
            <WizardStepRefinement
              agent={wizard.finalAgent}
              onNext={handleRefinementNext}
              onBack={() => wizard.setStep('candidates')}
            />
          )}

          {wizard.currentStep === 'onboarding' && wizard.finalAgent && (
            <WizardStepOnboarding
              agent={wizard.finalAgent}
              onComplete={handleOnboardingComplete}
              onSkip={handleOnboardingSkip}
              onBack={() => wizard.setStep('refinement')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
