import { useState } from 'react';
import type { AgentFull } from '../../../types/supabase';
import { SoulEditor } from '../SoulEditor';

interface WizardStepRefinementProps {
  agent: AgentFull;
  onNext: (agent: AgentFull) => void;
  onBack: () => void;
}

export function WizardStepRefinement({ agent, onNext, onBack }: WizardStepRefinementProps) {
  const [name, setName] = useState(agent.name);
  const [emoji, setEmoji] = useState(agent.emoji);

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">Refine Your Agent</h3>
        <p className="text-sm text-zinc-500">
          Fine-tune the name, personality, and SOUL profile before onboarding.
        </p>
      </div>

      {/* Name and Emoji */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Agent Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="w-24">
          <label className="block text-sm text-zinc-400 mb-1">Emoji</label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-center text-xl focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* SOUL Editor */}
      <SoulEditor
        soul={agent.soul}
        agent={{ ...agent, name, emoji }}
        onSave={(soul) => {
          onNext({ ...agent, name: name.trim() || agent.name, emoji: emoji || agent.emoji, soul });
        }}
        onCancel={onBack}
      />
    </div>
  );
}
