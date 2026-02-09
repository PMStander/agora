import type { AgentFull } from '../../../types/supabase';
import { cn } from '../../../lib/utils';

interface WizardStepCandidatesProps {
  candidates: AgentFull[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
  isGenerating: boolean;
}

function CandidateCard({
  candidate,
  isSelected,
  onClick,
  angle,
}: {
  candidate: AgentFull;
  isSelected: boolean;
  onClick: () => void;
  angle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 p-4 rounded-xl border text-left transition-all',
        isSelected
          ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30'
          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{candidate.emoji}</span>
        <div>
          <h4 className="font-medium text-zinc-100 text-sm">{candidate.name}</h4>
          <p className="text-xs text-zinc-500">{candidate.role}</p>
        </div>
      </div>

      {/* Angle badge */}
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-zinc-700 text-zinc-300 mb-3">
        {angle}
      </span>

      {/* Origin summary */}
      <p className="text-xs text-zinc-400 mb-3 line-clamp-3">{candidate.soul.origin}</p>

      {/* Top philosophy */}
      <div className="space-y-1 mb-3">
        {candidate.soul.philosophy.slice(0, 3).map((p, i) => (
          <p key={i} className="text-xs text-zinc-500 flex gap-1">
            <span className="text-amber-500/50 shrink-0">-</span>
            <span className="line-clamp-1">{p}</span>
          </p>
        ))}
      </div>

      {/* Communication style */}
      <div className="flex gap-1.5">
        <span className="px-1.5 py-0.5 rounded bg-zinc-700/50 text-[10px] text-zinc-400">
          {candidate.soul.communicationStyle.formality}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-zinc-700/50 text-[10px] text-zinc-400">
          {candidate.soul.communicationStyle.verbosity}
        </span>
      </div>

      {/* Select indicator */}
      <div className="mt-3 text-center">
        <span
          className={cn(
            'text-xs font-medium',
            isSelected ? 'text-amber-400' : 'text-zinc-600'
          )}
        >
          {isSelected ? 'Selected' : 'Click to select'}
        </span>
      </div>
    </button>
  );
}

const ANGLES = ['Analytical / Methodical', 'Creative / Narrative', 'Action-oriented / Pragmatic'];

export function WizardStepCandidates({
  candidates,
  selectedIndex,
  onSelect,
  onNext,
  onBack,
  isGenerating,
}: WizardStepCandidatesProps) {
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-zinc-400">Generating candidate profiles...</p>
        <p className="text-xs text-zinc-600 mt-1">This may take a moment</p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-zinc-400">No candidates generated yet.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">Choose Your Agent</h3>
        <p className="text-sm text-zinc-500">
          Select the personality that best fits your needs. You can refine in the next step.
        </p>
      </div>

      {/* Candidate cards */}
      <div className="flex gap-4 mb-8">
        {candidates.map((candidate, i) => (
          <CandidateCard
            key={i}
            candidate={candidate}
            isSelected={selectedIndex === i}
            onClick={() => onSelect(i)}
            angle={ANGLES[i] ?? `Variant ${i + 1}`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-zinc-800">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedIndex === null}
          className="px-6 py-2.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next: Refine
        </button>
      </div>
    </div>
  );
}
