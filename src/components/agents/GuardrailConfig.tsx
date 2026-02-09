import { useState, useEffect } from 'react';
import { useAgentLevel } from '../../hooks/useAgentLevel';
import { cn } from '../../lib/utils';
import { ALL_DOMAINS, AGENTS, type PermissionAction, type AgentGuardrails } from '../../types/supabase';

const ALL_ACTIONS: PermissionAction[] = [
  'mission:create',
  'mission:execute',
  'mission:approve_statement',
  'mission:approve_plan',
  'mission:assign',
  'task:execute',
  'task:create_subtask',
  'task:complete',
  'task:reassign',
  'comms:send_message',
  'comms:delegate',
  'comms:broadcast',
  'context:read',
  'context:write',
  'context:delete',
  'autonomous:act',
  'autonomous:self_schedule',
  'autonomous:override_lower',
];

interface GuardrailConfigProps {
  agentId: string;
}

export function GuardrailConfig({ agentId }: GuardrailConfigProps) {
  const { getGuardrails, updateGuardrails } = useAgentLevel();
  const guardrails = getGuardrails(agentId);
  const [local, setLocal] = useState<AgentGuardrails>(guardrails);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(guardrails);
  }, [guardrails]);

  const toggleDomain = (domain: string) => {
    setLocal((prev) => ({
      ...prev,
      allowed_domains: prev.allowed_domains.includes(domain)
        ? prev.allowed_domains.filter((d) => d !== domain)
        : [...prev.allowed_domains, domain],
    }));
  };

  const toggleDeniedAction = (action: PermissionAction) => {
    setLocal((prev) => ({
      ...prev,
      denied_actions: prev.denied_actions.includes(action)
        ? prev.denied_actions.filter((a) => a !== action)
        : [...prev.denied_actions, action],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await updateGuardrails(agentId, local);
    setSaving(false);
  };

  const otherAgents = AGENTS.filter((a) => a.id !== agentId);

  return (
    <div className="space-y-4">
      {/* Allowed Domains */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Allowed Domains
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DOMAINS.map((domain) => (
            <button
              key={domain}
              onClick={() => toggleDomain(domain)}
              className={cn(
                'px-2 py-1 text-xs rounded-md border transition-colors',
                local.allowed_domains.includes(domain)
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300',
              )}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Rate Limits */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Max Concurrent Missions</label>
          <input
            type="range"
            min={1}
            max={10}
            value={local.max_concurrent_missions}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                max_concurrent_missions: Number(e.target.value),
              }))
            }
            className="w-full accent-amber-500"
          />
          <div className="text-xs text-zinc-300 text-center">
            {local.max_concurrent_missions}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Max Daily Tasks</label>
          <input
            type="range"
            min={1}
            max={50}
            value={local.max_daily_tasks}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                max_daily_tasks: Number(e.target.value),
              }))
            }
            className="w-full accent-amber-500"
          />
          <div className="text-xs text-zinc-300 text-center">{local.max_daily_tasks}</div>
        </div>
      </div>

      {/* Auto-review threshold */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">
          Auto-Review Threshold ({local.auto_review_threshold.toFixed(2)})
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(local.auto_review_threshold * 100)}
          onChange={(e) =>
            setLocal((prev) => ({
              ...prev,
              auto_review_threshold: Number(e.target.value) / 100,
            }))
          }
          className="w-full accent-amber-500"
        />
      </div>

      {/* Escalation Agent */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Escalation Agent</label>
        <select
          value={local.escalation_agent_id || ''}
          onChange={(e) =>
            setLocal((prev) => ({
              ...prev,
              escalation_agent_id: e.target.value || null,
            }))
          }
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300"
        >
          <option value="">None</option>
          {otherAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.emoji} {agent.name} ({agent.role})
            </option>
          ))}
        </select>
      </div>

      {/* Denied Actions */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Denied Actions
        </label>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {ALL_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => toggleDeniedAction(action)}
              className={cn(
                'px-2 py-1 text-xs rounded-md border transition-colors',
                local.denied_actions.includes(action)
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300',
              )}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Guardrails'}
      </button>
    </div>
  );
}
