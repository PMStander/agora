import { useState, useEffect } from 'react';
import type { AgentFull } from '../../../types/supabase';
import { useAgentStore } from '../../../stores/agents';
import { useProjectsStore } from '../../../stores/projects';
import { useMissionControlStore } from '../../../stores/missionControl';
import { supabase } from '../../../lib/supabase';

interface Props {
  agent: AgentFull;
}

interface AgentAssignment {
  id: string;
  entity_id: string;
  role: string;
  assigned_at: string;
  project_name?: string;
  project_status?: string;
}

export default function AgentWsProjects({ agent }: Props) {
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const teams = useAgentStore((s) => s.teams);
  const selectProject = useProjectsStore((s) => s.selectProject);
  const setActiveTab = useMissionControlStore((s) => s.setActiveTab);

  // Find agent's team and hierarchy
  const agentTeam = teams.find((t) => t.agents.some((a) => a.id === agent.id));
  const agentEntry = agentTeam?.agents.find((a) => a.id === agent.id);
  const parentAgent = agentEntry?.parentAgentId
    ? agentTeam?.agents.find((a) => a.id === agentEntry.parentAgentId)
    : null;
  const subAgents = agentTeam?.agents.filter((a) => a.parentAgentId === agent.id) ?? [];
  const teamMembers = agentTeam?.agents.filter(
    (a) => a.id !== agent.id && a.parentAgentId === agentEntry?.parentAgentId && !a.parentAgentId === !agentEntry?.parentAgentId
  ) ?? [];

  // Load project assignments
  useEffect(() => {
    setLoading(true);
    supabase
      .from('crm_agent_assignments')
      .select('id, entity_id, role, assigned_at')
      .eq('agent_id', agent.id)
      .eq('entity_type', 'project')
      .then(async ({ data }) => {
        if (!data || data.length === 0) {
          setAssignments([]);
          setLoading(false);
          return;
        }

        // Enrich with project names
        const projectIds = data.map((d) => d.entity_id);
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, status')
          .in('id', projectIds);

        const projectMap = new Map(
          (projects ?? []).map((p) => [p.id, { name: p.name, status: p.status }])
        );

        setAssignments(
          data.map((d) => ({
            ...d,
            project_name: projectMap.get(d.entity_id)?.name ?? 'Unknown',
            project_status: projectMap.get(d.entity_id)?.status ?? '',
          }))
        );
        setLoading(false);
      }, () => setLoading(false));
  }, [agent.id]);

  const handleGoToProject = (projectId: string) => {
    selectProject(projectId);
    setActiveTab('projects');
  };

  const ROLE_COLORS: Record<string, string> = {
    lead: 'bg-amber-500/20 text-amber-400',
    owner: 'bg-amber-500/20 text-amber-400',
    collaborator: 'bg-blue-500/20 text-blue-400',
    watcher: 'bg-zinc-500/20 text-zinc-400',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Project Assignments */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">
          Project Assignments ({assignments.length})
        </h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-zinc-600 italic">Not assigned to any projects.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => handleGoToProject(a.entity_id)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800/30 rounded-lg hover:bg-zinc-800/60 transition-colors text-left"
              >
                <span className="text-lg">📂</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{a.project_name}</p>
                  <p className="text-xs text-zinc-500">
                    Assigned {new Date(a.assigned_at).toLocaleDateString()}
                    {a.project_status && ` · ${a.project_status}`}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${ROLE_COLORS[a.role] ?? ROLE_COLORS.watcher}`}>
                  {a.role}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Team Hierarchy */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Team Hierarchy</h3>

        {/* Parent */}
        {parentAgent && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Reports To</p>
            <AgentChip emoji={parentAgent.emoji} name={parentAgent.name} role={parentAgent.role} />
          </div>
        )}

        {/* Current Agent */}
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Current Agent</p>
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <span className="text-xl">{agent.emoji}</span>
            <div>
              <p className="text-sm text-amber-300 font-medium">{agent.name}</p>
              <p className="text-xs text-zinc-500">{agent.role}</p>
            </div>
          </div>
        </div>

        {/* Sub-agents */}
        {subAgents.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Direct Reports ({subAgents.length})
            </p>
            <div className="space-y-1.5 ml-4 border-l-2 border-zinc-800 pl-3">
              {subAgents.map((a) => (
                <AgentChip key={a.id} emoji={a.emoji} name={a.name} role={a.role} />
              ))}
            </div>
          </div>
        )}

        {/* Team members (same level) */}
        {teamMembers.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Team Members ({teamMembers.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {teamMembers.map((a) => (
                <AgentChip key={a.id} emoji={a.emoji} name={a.name} role={a.role} compact />
              ))}
            </div>
          </div>
        )}

        {/* Team info */}
        {agentTeam && (
          <div className="mt-4 pt-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              {agentTeam.emoji} {agentTeam.name} &middot; {agentTeam.agents.length} agents
              {agentEntry?.subTeamLabel && ` · ${agentEntry.subTeamLabel}`}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function AgentChip({
  emoji,
  name,
  role,
  compact,
}: {
  emoji: string;
  name: string;
  role: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/50 rounded-lg text-xs text-zinc-400">
        <span>{emoji}</span> {name}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/30 rounded-lg">
      <span className="text-lg">{emoji}</span>
      <div>
        <p className="text-sm text-zinc-300">{name}</p>
        <p className="text-xs text-zinc-500">{role}</p>
      </div>
    </div>
  );
}
