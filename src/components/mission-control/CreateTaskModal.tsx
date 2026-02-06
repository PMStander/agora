import { useState } from 'react';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore } from '../../stores/missionControl';
import { ALL_DOMAINS, type TaskPriority, type TeamType } from '../../types/supabase';

export function CreateTaskModal() {
  const { createTask, agents } = useMissionControl();
  const { isCreateModalOpen, setCreateModalOpen } = useMissionControlStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [team, setTeam] = useState<TeamType | ''>('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCreateModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await createTask(title, description, {
        priority,
        team: team || undefined,
        domains: selectedDomains,
        assigneeIds: selectedAgents.length > 0 ? selectedAgents : undefined,
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTeam('');
      setSelectedDomains([]);
      setSelectedAgents([]);
      setCreateModalOpen(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain]
    );
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const filteredAgents = team
    ? agents.filter((a) => a.team === team)
    : agents;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Create Task</h2>
          <button
            onClick={() => setCreateModalOpen(false)}
            className="text-zinc-500 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Priority & Team */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">🔥 Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Team</label>
              <select
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value as TeamType | '');
                  setSelectedAgents([]);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">Auto-detect</option>
                <option value="personal">Personal (Philosophers)</option>
                <option value="business">Business (Warriors)</option>
              </select>
            </div>
          </div>

          {/* Domains */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Domains (for auto-routing)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {ALL_DOMAINS.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  className={`
                    px-2 py-1 text-xs rounded-full border transition-colors
                    ${selectedDomains.includes(domain)
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }
                  `}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to agents (optional override) */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Assign to (leave empty for auto-routing)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAgent(agent.id)}
                  className={`
                    px-2 py-1 text-xs rounded-full border transition-colors flex items-center gap-1
                    ${selectedAgents.includes(agent.id)
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }
                  `}
                >
                  {agent.avatar_url && (
                    <img src={agent.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                  )}
                  {agent.name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
