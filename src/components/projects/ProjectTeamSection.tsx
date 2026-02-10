import { useState } from 'react';
import { getAgent } from '../../types/supabase';
import { SKILL_CATALOG } from '../../hooks/useGatewayConfig';
import { useProjectAgents } from '../../hooks/useProjectAgents';
import { useProjectSkills } from '../../hooks/useProjectSkills';
import type { ProjectAgentRole } from '../../types/projectAgents';
import { AddAgentToProjectModal } from './AddAgentToProjectModal';
import { ProjectSkillPicker } from './ProjectSkillPicker';

interface ProjectTeamSectionProps {
  projectId: string;
}

const ROLE_LABELS: Record<ProjectAgentRole, { label: string; color: string }> = {
  owner: { label: 'owner', color: 'bg-amber-500/20 text-amber-400' },
  collaborator: { label: 'collab', color: 'bg-blue-500/20 text-blue-400' },
  watcher: { label: 'watcher', color: 'bg-zinc-700 text-zinc-400' },
};

export function ProjectTeamSection({ projectId }: ProjectTeamSectionProps) {
  const { assignments, loading, assignAgent, removeAgent, updateRole } =
    useProjectAgents(projectId);
  const { addSkill, removeSkill, getSkillsForAgent } =
    useProjectSkills(projectId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [skillPickerAgentId, setSkillPickerAgentId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="border border-zinc-800 rounded-lg p-3">
        <label className="block text-xs text-zinc-500 mb-2">Project Team</label>
        <div className="text-xs text-zinc-600 animate-pulse">Loading team...</div>
      </div>
    );
  }

  const existingAgentIds = assignments.map((a) => a.agent_id);

  return (
    <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-500">
          Project Team ({assignments.length})
        </label>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs text-amber-400 hover:text-amber-300"
        >
          + Add
        </button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-xs text-zinc-600">No agents assigned to this project.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment) => {
            const agent = getAgent(assignment.agent_id);
            const agentSkills = getSkillsForAgent(assignment.agent_id);
            const roleCfg = ROLE_LABELS[assignment.role as ProjectAgentRole] ?? ROLE_LABELS.collaborator;

            return (
              <div
                key={assignment.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5"
              >
                {/* Agent header row */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">{agent?.emoji ?? '?'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-zinc-200 truncate">
                      {agent?.name ?? assignment.agent_id}
                    </span>
                    {agent && (
                      <span className="text-[10px] text-zinc-600 ml-1.5">
                        {agent.role}
                      </span>
                    )}
                  </div>

                  {/* Role badge (clickable for role menu) */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setRoleMenuId(roleMenuId === assignment.agent_id ? null : assignment.agent_id)
                      }
                      className={`text-[10px] px-1.5 py-0.5 rounded ${roleCfg.color} hover:opacity-80`}
                    >
                      {roleCfg.label}
                    </button>

                    {roleMenuId === assignment.agent_id && (
                      <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded shadow-lg z-10 py-1 min-w-[100px]">
                        {(['owner', 'collaborator', 'watcher'] as ProjectAgentRole[]).map((r) => (
                          <button
                            key={r}
                            onClick={async () => {
                              await updateRole(assignment.agent_id, r);
                              setRoleMenuId(null);
                            }}
                            className={`w-full text-left px-3 py-1 text-xs hover:bg-zinc-700 ${
                              assignment.role === r ? 'text-amber-400' : 'text-zinc-300'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  {confirmRemoveId === assignment.agent_id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          await removeAgent(assignment.agent_id);
                          setConfirmRemoveId(null);
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="text-[10px] text-zinc-500"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveId(assignment.agent_id)}
                      className="text-xs text-zinc-600 hover:text-red-400"
                      title="Remove agent"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Skills row */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {/* Technology skills (amber) */}
                  {agentSkills.technology.map((sk) => (
                    <span
                      key={`t-${sk}`}
                      className="group inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-amber-500/15 text-amber-400 rounded"
                    >
                      {sk}
                      <button
                        onClick={() => removeSkill(assignment.agent_id, sk)}
                        className="hidden group-hover:inline text-amber-600 hover:text-amber-300 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}

                  {/* Gateway skills (blue) */}
                  {agentSkills.gateway.map((sk) => {
                    const meta = SKILL_CATALOG[sk];
                    return (
                      <span
                        key={`g-${sk}`}
                        className="group inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-blue-500/15 text-blue-400 rounded"
                      >
                        {meta?.icon ?? '?'} {meta?.label ?? sk}
                        <button
                          onClick={() => removeSkill(assignment.agent_id, sk)}
                          className="hidden group-hover:inline text-blue-600 hover:text-blue-300 ml-0.5"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}

                  {/* Add skill button */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setSkillPickerAgentId(
                          skillPickerAgentId === assignment.agent_id
                            ? null
                            : assignment.agent_id
                        )
                      }
                      className="px-1.5 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 border border-dashed border-zinc-700 rounded hover:border-zinc-500 transition-colors"
                    >
                      + skill
                    </button>

                    {skillPickerAgentId === assignment.agent_id && (
                      <ProjectSkillPicker
                        existingSkills={agentSkills}
                        onAdd={async (skillKey, skillType) => {
                          await addSkill(assignment.agent_id, skillKey, skillType);
                        }}
                        onClose={() => setSkillPickerAgentId(null)}
                      />
                    )}
                  </div>

                  {agentSkills.technology.length === 0 &&
                    agentSkills.gateway.length === 0 && (
                      <span className="text-[10px] text-zinc-700">No project skills</span>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddModal && (
        <AddAgentToProjectModal
          existingAgentIds={existingAgentIds}
          onAdd={assignAgent}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
