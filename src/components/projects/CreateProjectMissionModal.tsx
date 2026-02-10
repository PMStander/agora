import { useState, useMemo } from 'react';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useProjects } from '../../hooks/useProjects';
import { useProjectAgents } from '../../hooks/useProjectAgents';
import { useProjectSkills } from '../../hooks/useProjectSkills';
import { AGENTS } from '../../types/supabase';
import type { MissionPriority } from '../../types/supabase';

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  onClose: () => void;
}

export function CreateProjectMissionModal({ projectId, onClose }: Props) {
  const { createMission } = useMissionControl();
  const { linkMissionToProject } = useProjects();
  const { assignments } = useProjectAgents(projectId);
  const { skills } = useProjectSkills(projectId);

  // Smart defaults: prefer project team agents
  const teamAgentIds = useMemo(
    () => assignments.map((a) => a.agent_id),
    [assignments]
  );

  // Get technology skills for context pre-fill
  const techSkills = useMemo(
    () => [...new Set(skills.filter((s) => s.skill_type === 'technology').map((s) => s.skill_key))],
    [skills]
  );

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState(
    techSkills.length > 0
      ? `Tech stack: ${techSkills.join(', ')}\n\n`
      : ''
  );
  const [agentId, setAgentId] = useState(teamAgentIds[0] || AGENTS[0]?.id || '');
  const [priority, setPriority] = useState<MissionPriority>('medium');
  const [submitting, setSubmitting] = useState(false);

  // Partition agents: team first, then all others
  const teamAgents = useMemo(
    () => AGENTS.filter((a) => teamAgentIds.includes(a.id)),
    [teamAgentIds]
  );
  const otherAgents = useMemo(
    () => AGENTS.filter((a) => !teamAgentIds.includes(a.id)),
    [teamAgentIds]
  );

  const handleSubmit = async () => {
    if (!title.trim() || !agentId) return;
    setSubmitting(true);

    try {
      const mission = await createMission({
        title: title.trim(),
        description: instructions || undefined,
        input_text: instructions || undefined,
        agent_id: agentId,
        priority,
        scheduled_at: new Date().toISOString(),
      });

      if (mission) {
        // Auto-link to project
        await linkMissionToProject(projectId, mission.id);
      }

      onClose();
    } catch (err) {
      console.error('[CreateProjectMission] error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Create Mission for Project</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            {'\u2715'}
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              placeholder="Detailed instructions for the agent..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-500 font-mono text-xs"
            />
            {techSkills.length > 0 && (
              <p className="text-[10px] text-zinc-600 mt-1">
                {'\u2728'} Tech stack pre-filled from project skills
              </p>
            )}
          </div>

          {/* Agent */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Assign Agent *</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              {teamAgents.length > 0 && (
                <optgroup label="Project Team">
                  {teamAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emoji} {a.name} - {a.role}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={teamAgents.length > 0 ? 'All Agents' : 'Agents'}>
                {otherAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} - {a.role}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'urgent'] as MissionPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    priority === p
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !agentId || submitting}
            className="px-4 py-2 text-xs bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create & Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
