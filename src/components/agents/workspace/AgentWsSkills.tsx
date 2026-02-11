import { useState } from 'react';
import type { AgentFull } from '../../../types/supabase';
import { useGatewayConfig, SKILL_CATALOG } from '../../../hooks/useGatewayConfig';
import { readSkillFile } from '../../../hooks/useAgentWorkspace';

interface Props {
  agent: AgentFull;
}

export default function AgentWsSkills({ agent }: Props) {
  const gateway = useGatewayConfig({ agentId: agent.id });
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillDoc, setSkillDoc] = useState<string>('');
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const configuredSkills = gateway.configuredSkills ?? [];
  const allSkills = gateway.allSkills ?? [];

  const handleViewSkill = async (skillKey: string) => {
    setSelectedSkill(skillKey);
    setLoadingDoc(true);
    try {
      const doc = await readSkillFile(skillKey, agent.id);
      setSkillDoc(doc);
    } catch {
      setSkillDoc('');
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleToggleSkill = async (skillKey: string) => {
    if (toggling) return;
    setToggling(skillKey);
    try {
      const isAssigned = configuredSkills.includes(skillKey);
      const updated = isAssigned
        ? configuredSkills.filter((s) => s !== skillKey)
        : [...configuredSkills, skillKey];
      await gateway.setSkills(updated, agent.id);
      // Re-fetch skills status to reflect changes
      await gateway.fetchSkillsStatus();
    } catch (err) {
      console.error('[AgentWsSkills] Failed to toggle skill:', err);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Assigned Skills */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">
          Assigned Skills ({configuredSkills.length})
        </h3>
        {configuredSkills.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">No skills configured for this agent.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {configuredSkills.map((skill) => {
              const meta = SKILL_CATALOG[skill];
              return (
                <button
                  key={skill}
                  onClick={() => handleViewSkill(skill)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors
                    ${selectedSkill === skill
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                    }
                  `}
                >
                  <span>{meta?.icon ?? '⚡'}</span>
                  {meta?.label ?? skill}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Skill Document Viewer */}
      {selectedSkill && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-300">
              {SKILL_CATALOG[selectedSkill]?.icon ?? '⚡'} {SKILL_CATALOG[selectedSkill]?.label ?? selectedSkill} — SKILL.md
            </h3>
            <button
              onClick={() => setSelectedSkill(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
          {loadingDoc ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : skillDoc ? (
            <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
              {skillDoc}
            </pre>
          ) : (
            <p className="text-sm text-zinc-600 italic">No SKILL.md documentation found.</p>
          )}
        </section>
      )}

      {/* All Available Skills (toggleable) */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-1">
          All Available Skills ({allSkills.length})
        </h3>
        <p className="text-xs text-zinc-600 mb-4">Click to assign or remove skills from this agent.</p>
        <div className="flex flex-wrap gap-2">
          {allSkills.map((skill: string) => {
            const isAssigned = configuredSkills.includes(skill);
            const meta = SKILL_CATALOG[skill];
            const isCurrentlyToggling = toggling === skill;
            return (
              <button
                key={skill}
                onClick={() => handleToggleSkill(skill)}
                disabled={!!toggling}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all
                  ${isCurrentlyToggling ? 'opacity-50' : ''}
                  ${isAssigned
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
                    : 'bg-zinc-800/30 border-zinc-700/50 text-zinc-500 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400'
                  }
                  ${toggling && !isCurrentlyToggling ? 'cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span>{meta?.icon ?? '⚡'}</span>
                {meta?.label ?? skill}
                {isAssigned && !isCurrentlyToggling && <span className="ml-1">✓</span>}
                {isCurrentlyToggling && (
                  <span className="ml-1 animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Domains */}
      {agent.domains.length > 0 && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Domain Expertise</h3>
          <div className="space-y-2">
            {agent.domains.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-zinc-200 min-w-[120px]">{d.domain}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${d.depth === 'novice' ? 25 : d.depth === 'intermediate' ? 50 : d.depth === 'expert' ? 75 : 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 capitalize">
                  {d.depth}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
