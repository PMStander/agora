import { useState, useMemo } from 'react';
import type { AgentFull } from '../../../types/supabase';
import { useGatewayConfig, prettifyCategory, type SkillInfo } from '../../../hooks/useGatewayConfig';
import { readSkillFile } from '../../../hooks/useAgentWorkspace';

interface Props {
  agent: AgentFull;
}

function getSkillDisplay(skill: string, skillInfoMap: Map<string, SkillInfo>) {
  const info = skillInfoMap.get(skill);
  return {
    label: info?.label ?? skill,
    icon: info?.icon ?? '⚡',
    description: info?.description ?? '',
    category: info?.category ?? 'other',
  };
}

export default function AgentWsSkills({ agent }: Props) {
  const gateway = useGatewayConfig({ agentId: agent.id });
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillDoc, setSkillDoc] = useState<string>('');
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Browse catalog state
  const [browseExpanded, setBrowseExpanded] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const configuredSkills = gateway.configuredSkills ?? [];
  const allSkills = gateway.allSkills ?? [];
  const allGatewaySkillKeys = gateway.allGatewaySkillKeys ?? [];
  const eligibleSkillSet = gateway.eligibleSkillSet ?? new Set<string>();
  const skillInfoMap = gateway.skillInfoMap;

  // Build sorted category list with counts (eligible skills only)
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const skill of allSkills) {
      const { category } = getSkillDisplay(skill, skillInfoMap);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, count]) => ({ slug, label: prettifyCategory(slug), count }));
  }, [allSkills, skillInfoMap]);

  // Filter eligible skills by category + search
  const filteredSkills = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return allSkills.filter((skill) => {
      const display = getSkillDisplay(skill, skillInfoMap);
      if (selectedCategory && display.category !== selectedCategory) return false;
      if (query) {
        const haystack = `${skill} ${display.label} ${display.description}`.toLowerCase();
        return haystack.includes(query);
      }
      return true;
    });
  }, [allSkills, skillInfoMap, selectedCategory, searchQuery]);

  // Browse catalog: group ALL gateway skills by category with search
  const browseData = useMemo(() => {
    const query = browseSearch.toLowerCase().trim();
    const grouped = new Map<string, { slug: string; label: string; skills: string[] }>();

    for (const skillKey of allGatewaySkillKeys) {
      const info = skillInfoMap.get(skillKey);
      const category = info?.category ?? 'other';

      if (query) {
        const haystack = `${skillKey} ${info?.label ?? ''} ${info?.description ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) continue;
      }

      if (!grouped.has(category)) {
        grouped.set(category, { slug: category, label: prettifyCategory(category), skills: [] });
      }
      grouped.get(category)!.skills.push(skillKey);
    }

    const groups = Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
    for (const group of groups) {
      group.skills.sort((a, b) => {
        const la = skillInfoMap.get(a)?.label ?? a;
        const lb = skillInfoMap.get(b)?.label ?? b;
        return la.localeCompare(lb);
      });
    }

    return {
      groups,
      totalCount: allGatewaySkillKeys.length,
      filteredCount: groups.reduce((sum, g) => sum + g.skills.length, 0),
    };
  }, [allGatewaySkillKeys, skillInfoMap, browseSearch]);

  const toggleCategory = (slug: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

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
              const display = getSkillDisplay(skill, skillInfoMap);
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
                  <span>{display.icon}</span>
                  {display.label}
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
              {getSkillDisplay(selectedSkill, skillInfoMap).icon} {getSkillDisplay(selectedSkill, skillInfoMap).label} — SKILL.md
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

      {/* All Available Skills (toggleable, filterable) */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-1">
          Available Skills ({allSkills.length})
        </h3>
        <p className="text-xs text-zinc-600 mb-4">Click to assign or remove skills from this agent.</p>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
          />
        </div>

        {/* Category Filter Chips */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`
                px-2.5 py-1 text-xs font-medium rounded-lg transition-colors
                ${selectedCategory === null
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 hover:border-zinc-600'
                }
              `}
            >
              All ({allSkills.length})
            </button>
            {categories.map(({ slug, label, count }) => (
              <button
                key={slug}
                onClick={() => setSelectedCategory(selectedCategory === slug ? null : slug)}
                className={`
                  px-2.5 py-1 text-xs font-medium rounded-lg transition-colors
                  ${selectedCategory === slug
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 hover:border-zinc-600'
                  }
                `}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}

        {/* Filtered Skills Grid */}
        {filteredSkills.length === 0 ? (
          <p className="text-sm text-zinc-600 italic py-4 text-center">
            No skills match{selectedCategory ? ` "${prettifyCategory(selectedCategory)}"` : ''}{searchQuery ? ` "${searchQuery}"` : ''}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredSkills.map((skill: string) => {
              const isAssigned = configuredSkills.includes(skill);
              const display = getSkillDisplay(skill, skillInfoMap);
              const isCurrentlyToggling = toggling === skill;
              return (
                <button
                  key={skill}
                  onClick={() => handleToggleSkill(skill)}
                  disabled={!!toggling}
                  title={display.description || undefined}
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
                  <span>{display.icon}</span>
                  {display.label}
                  {isAssigned && !isCurrentlyToggling && <span className="ml-1">✓</span>}
                  {isCurrentlyToggling && (
                    <span className="ml-1 animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Show result count when filtering */}
        {(selectedCategory || searchQuery) && filteredSkills.length > 0 && (
          <p className="text-xs text-zinc-600 mt-3">
            Showing {filteredSkills.length} of {allSkills.length} skills
          </p>
        )}
      </section>

      {/* Browse All System Skills (collapsible catalog) */}
      {allGatewaySkillKeys.length > allSkills.length && (
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Disclosure header */}
          <button
            onClick={() => setBrowseExpanded(!browseExpanded)}
            className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-zinc-800/30 transition-colors"
          >
            <svg
              className={`w-4 h-4 text-zinc-500 transition-transform ${browseExpanded ? 'rotate-0' : '-rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <h3 className="text-sm font-medium text-zinc-300">
              Browse All System Skills
            </h3>
            <span className="text-xs text-zinc-600">
              ({browseData.totalCount})
            </span>
          </button>

          {/* Expanded content */}
          {browseExpanded && (
            <div className="px-5 pb-5 space-y-4">
              <p className="text-xs text-zinc-600">
                Discover and assign skills from the full system catalog.
                Skills marked <span className="text-amber-500/70">eligible</span> are ready to use; others may require gateway setup.
              </p>

              {/* Browse search */}
              <input
                type="text"
                placeholder="Search all skills..."
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
              />

              {/* Search result count */}
              {browseSearch && (
                <p className="text-xs text-zinc-600">
                  Showing {browseData.filteredCount} of {browseData.totalCount} skills
                </p>
              )}

              {/* Category groups */}
              {browseData.groups.length === 0 ? (
                <p className="text-sm text-zinc-600 italic py-4 text-center">
                  No skills match &quot;{browseSearch}&quot;.
                </p>
              ) : (
                <div className="space-y-1">
                  {browseData.groups.map((group) => (
                    <div key={group.slug} className="border border-zinc-800/50 rounded-lg overflow-hidden">
                      {/* Category header */}
                      <button
                        onClick={() => toggleCategory(group.slug)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                      >
                        <svg
                          className={`w-3 h-3 text-zinc-600 transition-transform ${expandedCategories.has(group.slug) ? 'rotate-0' : '-rotate-90'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span className="text-xs font-medium text-zinc-400">
                          {group.label}
                        </span>
                        <span className="text-xs text-zinc-600">
                          ({group.skills.length})
                        </span>
                      </button>

                      {/* Category skills */}
                      {expandedCategories.has(group.slug) && (
                        <div className="px-3 pb-3 flex flex-wrap gap-2">
                          {group.skills.map((skillKey) => {
                            const info = skillInfoMap.get(skillKey);
                            const isAssigned = configuredSkills.includes(skillKey);
                            const isEligible = eligibleSkillSet.has(skillKey);
                            const isCurrentlyToggling = toggling === skillKey;

                            return (
                              <button
                                key={skillKey}
                                onClick={() => handleToggleSkill(skillKey)}
                                disabled={!!toggling}
                                title={[
                                  info?.description,
                                  isEligible ? '(eligible)' : '(not eligible)',
                                  isAssigned ? '(assigned)' : '',
                                ].filter(Boolean).join(' ')}
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
                                <span>{info?.icon ?? '⚡'}</span>
                                {info?.label ?? skillKey}
                                {isAssigned && !isCurrentlyToggling && <span className="ml-1">✓</span>}
                                {!isAssigned && isEligible && (
                                  <span className="ml-1 text-[10px] text-amber-500/60 font-medium">eligible</span>
                                )}
                                {isCurrentlyToggling && (
                                  <span className="ml-1 animate-spin inline-block w-3 h-3 border border-current border-t-transparent rounded-full" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

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
