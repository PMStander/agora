import { useState, useMemo } from 'react';
import { useProjectContextDocs } from '../../hooks/useProjectContextDocs';
import { useProjectSkills } from '../../hooks/useProjectSkills';
import { useProjectAgents } from '../../hooks/useProjectAgents';
import { ContextDocEditor } from './ContextDocEditor';
import { getAgent } from '../../types/supabase';
import { useProjectsStore } from '../../stores/projects';
import type { ContextDocType } from '../../types/context';
import type { Project } from '../../stores/projects';

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  project: Project;
}

const DOC_TYPES: Array<{ value: ContextDocType; label: string }> = [
  { value: 'context', label: 'Context' },
  { value: 'research', label: 'Research' },
  { value: 'decision_log', label: 'Decision Log' },
];

export function ProjectWorkspaceContext({ project }: Props) {
  const { docs, loading, createDoc, updateDoc, updateDocTitle, deleteDoc } =
    useProjectContextDocs(project.id);
  const { skills } = useProjectSkills(project.id);
  const { assignments } = useProjectAgents(project.id);
  const setWorkspaceTab = useProjectsStore((s) => s.setWorkspaceTab);

  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState<ContextDocType>('context');

  // Technology skills per agent
  const techByAgent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of skills) {
      if (s.skill_type !== 'technology') continue;
      const existing = map.get(s.agent_id) || [];
      existing.push(s.skill_key);
      map.set(s.agent_id, existing);
    }
    return map;
  }, [skills]);

  // All unique tech skills
  const allTechSkills = useMemo(
    () => [...new Set(skills.filter((s) => s.skill_type === 'technology').map((s) => s.skill_key))],
    [skills]
  );

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim()) return;
    await createDoc(
      newDocTitle.trim(),
      `# ${newDocTitle.trim()}\n\n`,
      newDocType
    );
    setNewDocTitle('');
    setShowNewDoc(false);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Context Documents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-500">
            Context Documents ({docs.length})
          </label>
          <button
            onClick={() => setShowNewDoc(!showNewDoc)}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            + New Document
          </button>
        </div>

        {/* New document form */}
        {showNewDoc && (
          <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateDoc()}
                placeholder="Document title..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                autoFocus
              />
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as ContextDocType)}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateDoc}
                disabled={!newDocTitle.trim()}
                className="px-3 py-1 text-xs bg-amber-500 text-black rounded disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewDoc(false)}
                className="px-3 py-1 text-xs text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-xs text-zinc-600 text-center py-4">Loading...</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500">No context documents yet</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Context docs are auto-injected into agent conversations
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <ContextDocEditor
                key={doc.id}
                doc={doc}
                onUpdate={updateDoc}
                onUpdateTitle={updateDocTitle}
                onDelete={deleteDoc}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Technology Stack Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-500">Technology Stack</label>
          <button
            onClick={() => setWorkspaceTab('settings')}
            className="text-[10px] text-zinc-600 hover:text-zinc-400"
          >
            Manage in Setup {'\u2192'}
          </button>
        </div>

        {allTechSkills.length === 0 ? (
          <div className="text-center py-4 border border-dashed border-zinc-800 rounded-lg">
            <p className="text-xs text-zinc-500">No technology skills configured</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Add tech skills in the Setup tab to give agents context
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => {
              const agent = getAgent(assignment.agent_id);
              const techKeys = techByAgent.get(assignment.agent_id);
              if (!techKeys || techKeys.length === 0) return null;
              return (
                <div key={assignment.agent_id} className="flex items-start gap-2">
                  <span className="text-xs text-zinc-400 shrink-0 mt-0.5">
                    {agent ? `${agent.emoji} ${agent.name}` : assignment.agent_id}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {techKeys.map((key) => (
                      <span
                        key={key}
                        className="px-1.5 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 rounded border border-amber-500/20"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Show any skills not covered by assignments */}
            {(() => {
              const assignedAgentIds = new Set(assignments.map((a) => a.agent_id));
              const unassigned = skills.filter(
                (s) => s.skill_type === 'technology' && !assignedAgentIds.has(s.agent_id)
              );
              if (unassigned.length === 0) return null;
              const grouped = new Map<string, string[]>();
              for (const s of unassigned) {
                const existing = grouped.get(s.agent_id) || [];
                existing.push(s.skill_key);
                grouped.set(s.agent_id, existing);
              }
              return [...grouped.entries()].map(([agentId, keys]) => {
                const agent = getAgent(agentId);
                return (
                  <div key={agentId} className="flex items-start gap-2">
                    <span className="text-xs text-zinc-400 shrink-0 mt-0.5">
                      {agent ? `${agent.emoji} ${agent.name}` : agentId}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {keys.map((key) => (
                        <span
                          key={key}
                          className="px-1.5 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 rounded border border-amber-500/20"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
