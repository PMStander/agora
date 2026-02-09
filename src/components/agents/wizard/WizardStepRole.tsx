import { useState } from 'react';
import { ALL_DOMAINS, type HiringRoleSpec, type TeamType } from '../../../types/supabase';
import { cn } from '../../../lib/utils';

interface WizardStepRoleProps {
  initialSpec: HiringRoleSpec | null;
  onNext: (spec: HiringRoleSpec) => void;
}

const TEAMS: { id: TeamType; label: string; emoji: string }[] = [
  { id: 'orchestrator', label: 'Orchestrator', emoji: '🏛️' },
  { id: 'personal', label: 'Personal', emoji: '📚' },
  { id: 'business', label: 'Business', emoji: '⚔️' },
  { id: 'engineering', label: 'The Forge', emoji: '⚒️' },
];

const ARCHETYPES = [
  'Let AI decide',
  'Historical figure',
  'Philosopher',
  'Scientist',
  'Military leader',
  'Artist',
  'Mythological figure',
];

export function WizardStepRole({ initialSpec, onNext }: WizardStepRoleProps) {
  const [roleTitle, setRoleTitle] = useState(initialSpec?.roleTitle ?? '');
  const [team, setTeam] = useState<TeamType>(initialSpec?.team ?? 'business');
  const [selectedDomains, setSelectedDomains] = useState<string[]>(initialSpec?.domains ?? []);
  const [specialization, setSpecialization] = useState(initialSpec?.specialization ?? '');
  const [archetype, setArchetype] = useState<string | null>(initialSpec?.archetype ?? null);

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) => {
      if (prev.includes(domain)) return prev.filter((d) => d !== domain);
      if (prev.length >= 5) return prev;
      return [...prev, domain];
    });
  };

  const isValid = roleTitle.trim() && selectedDomains.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onNext({
      roleTitle: roleTitle.trim(),
      team,
      domains: selectedDomains,
      specialization: specialization.trim(),
      archetype: archetype === 'Let AI decide' ? null : archetype,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">Define the Role</h3>
        <p className="text-sm text-zinc-500">What kind of agent do you need?</p>
      </div>

      {/* Role Title */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Role Title *</label>
        <input
          type="text"
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder="e.g. Content Strategist, Data Analyst, Project Manager"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          autoFocus
        />
      </div>

      {/* Team */}
      <div>
        <label className="block text-sm text-zinc-400 mb-2">Team Assignment</label>
        <div className="flex gap-3">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeam(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors',
                team === t.id
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
              )}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Domains */}
      <div>
        <label className="block text-sm text-zinc-400 mb-2">
          Primary Domains * <span className="text-zinc-600">(up to 5)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_DOMAINS.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => toggleDomain(domain)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs transition-colors border',
                selectedDomains.includes(domain)
                  ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
              )}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Specialization */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Specialization Description</label>
        <textarea
          value={specialization}
          onChange={(e) => setSpecialization(e.target.value)}
          rows={3}
          placeholder="Describe what this agent should focus on and excel at..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none transition-colors text-sm"
        />
      </div>

      {/* Archetype */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Character Archetype (optional)</label>
        <select
          value={archetype ?? 'Let AI decide'}
          onChange={(e) => setArchetype(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors text-sm"
        >
          {ARCHETYPES.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Next */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className="px-6 py-2.5 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next: Build Soul
        </button>
      </div>
    </form>
  );
}
