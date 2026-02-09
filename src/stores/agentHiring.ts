import { create } from 'zustand';
import type { AgentFull, HiringRoleSpec, SoulProfile } from '../types/supabase';

export type HiringWizardStep = 'role' | 'soul_builder' | 'candidates' | 'refinement' | 'onboarding';

interface HiringWizardState {
  currentStep: HiringWizardStep;
  roleSpec: HiringRoleSpec | null;
  soulBuilderMessages: Array<{ role: 'system' | 'user'; content: string }>;
  draftSoul: SoulProfile | null;
  candidates: AgentFull[];
  selectedCandidateIndex: number | null;
  finalAgent: AgentFull | null;

  // Actions
  setStep: (step: HiringWizardStep) => void;
  setRoleSpec: (spec: HiringRoleSpec) => void;
  addSoulBuilderMessage: (msg: { role: 'system' | 'user'; content: string }) => void;
  setDraftSoul: (soul: SoulProfile) => void;
  setCandidates: (candidates: AgentFull[]) => void;
  selectCandidate: (index: number) => void;
  setFinalAgent: (agent: AgentFull) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 'role' as HiringWizardStep,
  roleSpec: null,
  soulBuilderMessages: [],
  draftSoul: null,
  candidates: [],
  selectedCandidateIndex: null,
  finalAgent: null,
};

export const useHiringWizardStore = create<HiringWizardState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),

  setRoleSpec: (spec) => set({ roleSpec: spec }),

  addSoulBuilderMessage: (msg) =>
    set((state) => ({
      soulBuilderMessages: [...state.soulBuilderMessages, msg],
    })),

  setDraftSoul: (soul) => set({ draftSoul: soul }),

  setCandidates: (candidates) => set({ candidates }),

  selectCandidate: (index) => set({ selectedCandidateIndex: index }),

  setFinalAgent: (agent) => set({ finalAgent: agent }),

  reset: () => set(initialState),
}));
