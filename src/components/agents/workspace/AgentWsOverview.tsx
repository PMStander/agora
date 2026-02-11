import type { AgentFull } from '../../../types/supabase';
import { useAgentStore } from '../../../stores/agents';
import { useAgentWorkspace } from '../../../hooks/useAgentWorkspace';
import { useGatewayConfig } from '../../../hooks/useGatewayConfig';

interface Props {
  agent: AgentFull;
}

const LIFECYCLE_STEPS = [
  { key: 'soul_review', label: 'SOUL Reviewed' },
  { key: 'avatar_set', label: 'Avatar Set' },
  { key: 'team_assigned', label: 'Team Assigned' },
  { key: 'intro_message_sent', label: 'Intro Sent' },
  { key: 'first_task_assigned', label: 'First Task' },
  { key: 'workflow_configured', label: 'Workflows' },
];

export default function AgentWsOverview({ agent }: Props) {
  const setTab = useAgentStore((s) => s.setAgentWorkspaceTab);
  const { loading, cronJobs, sessions } = useAgentWorkspace(agent.id);
  const gateway = useGatewayConfig({ agentId: agent.id });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Identity Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Identity */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="text-4xl">{agent.emoji}</div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-zinc-100">{agent.name}</h2>
              <p className="text-sm text-zinc-400">{agent.role}</p>
              <p className="text-sm text-zinc-500 mt-1">{agent.persona}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded">
                  {agent.team}
                </span>
                <span className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded">
                  v{agent.soulVersion}
                </span>
              </div>
            </div>
          </div>

          {/* Origin blurb */}
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
            {agent.soul.origin}
          </p>
        </div>

        {/* Right: Quick Stats */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-zinc-300">Quick Stats</h3>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Provider" value={gateway.providerId ?? agent.provider} />
            <StatCard label="Model" value={gateway.modelId ?? agent.model} />
            <StatCard label="Sessions" value={loading ? '...' : String(sessions.length)} />
            <StatCard label="Cron Jobs" value={loading ? '...' : String(cronJobs.length)} />
          </div>

          {/* Dates */}
          <div className="space-y-1 text-xs text-zinc-500">
            {agent.hiredAt && (
              <p>Hired: {new Date(agent.hiredAt).toLocaleDateString()}</p>
            )}
            {agent.onboardedAt && (
              <p>Onboarded: {new Date(agent.onboardedAt).toLocaleDateString()}</p>
            )}
            {agent.retiredAt && (
              <p>Retired: {new Date(agent.retiredAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Onboarding Timeline */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Onboarding Progress</h3>
        <div className="flex items-center gap-1">
          {LIFECYCLE_STEPS.map((step, i) => {
            const item = agent.onboardingChecklist.find((c) => c.step === step.key);
            const done = item?.completed ?? false;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div
                  className={`w-full h-2 rounded-full ${done ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  title={`${step.label}${done && item?.completedAt ? ` (${new Date(item.completedAt).toLocaleDateString()})` : ''}`}
                />
                {i < LIFECYCLE_STEPS.length - 1 && <div className="w-1" />}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {LIFECYCLE_STEPS.map((step) => {
            const done = agent.onboardingChecklist.find((c) => c.step === step.key)?.completed;
            return (
              <span key={step.key} className={`text-[10px] ${done ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {step.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { tab: 'identity' as const, label: 'Edit SOUL', icon: '🧠' },
          { tab: 'skills' as const, label: 'Manage Skills', icon: '🔧' },
          { tab: 'files' as const, label: 'Browse Files', icon: '📁' },
          { tab: 'projects' as const, label: 'View Projects', icon: '📂' },
          { tab: 'performance' as const, label: 'Performance', icon: '📊' },
        ].map(({ tab, label, icon }) => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className="flex items-center gap-2 px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Philosophy snapshot */}
      {agent.soul.philosophy.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Core Philosophy</h3>
          <ul className="space-y-1.5">
            {agent.soul.philosophy.map((p, i) => (
              <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">&#x2022;</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200 truncate mt-0.5">{value}</p>
    </div>
  );
}
