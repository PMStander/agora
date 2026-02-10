import { useState } from 'react';
import { AGENTS } from '../../types/supabase';
import type { ProjectAgentRole } from '../../types/projectAgents';

interface AddAgentToProjectModalProps {
  existingAgentIds: string[];
  onAdd: (agentId: string, role: ProjectAgentRole) => Promise<boolean>;
  onClose: () => void;
}

const ROLE_OPTIONS: { value: ProjectAgentRole; label: string }[] = [
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'owner', label: 'Owner' },
  { value: 'watcher', label: 'Watcher' },
];

export function AddAgentToProjectModal({
  existingAgentIds,
  onAdd,
  onClose,
}: AddAgentToProjectModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [role, setRole] = useState<ProjectAgentRole>('collaborator');
  const [submitting, setSubmitting] = useState(false);

  const availableAgents = AGENTS.filter((a) => !existingAgentIds.includes(a.id));

  const handleSubmit = async () => {
    if (!selectedAgentId) return;
    setSubmitting(true);
    const ok = await onAdd(selectedAgentId, role);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Add Agent to Project</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Agent selector */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Agent</label>
            {availableAgents.length === 0 ? (
              <p className="text-xs text-zinc-600">All agents are already assigned.</p>
            ) : (
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Select agent...</option>
                {availableAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} - {a.role}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Role</label>
            <div className="flex gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRole(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    role === opt.value
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedAgentId || submitting}
            className="px-4 py-1.5 text-xs bg-amber-500 text-black rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding...' : 'Add Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}
