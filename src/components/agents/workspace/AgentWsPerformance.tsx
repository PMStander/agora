import { useState, useEffect } from 'react';
import type { AgentFull } from '../../../types/supabase';
import { AgentLevelDetail } from '../AgentLevelDetail';
import { ViolationsFeed } from '../ViolationsFeed';
import { supabase } from '../../../lib/supabase';
import { useAgentWorkspace } from '../../../hooks/useAgentWorkspace';

interface Props {
  agent: AgentFull;
}

interface MissionSummary {
  id: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export default function AgentWsPerformance({ agent }: Props) {
  const [missions, setMissions] = useState<MissionSummary[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const { sessions } = useAgentWorkspace(agent.id);

  // Load missions assigned to this agent
  useEffect(() => {
    setLoadingMissions(true);
    supabase
      .from('missions')
      .select('id, title, status, created_at, completed_at')
      .or(`assigned_agent_id.eq.${agent.id},owner_agent_id.eq.${agent.id}`)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMissions(data ?? []);
        setLoadingMissions(false);
      }, () => setLoadingMissions(false));
  }, [agent.id]);

  const completedMissions = missions.filter((m) => m.status === 'completed' || m.status === 'done');
  const activeMissions = missions.filter((m) => m.status === 'active' || m.status === 'in_progress');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Missions"
          value={loadingMissions ? '...' : String(missions.length)}
        />
        <StatCard
          label="Completed"
          value={loadingMissions ? '...' : String(completedMissions.length)}
          color="text-emerald-400"
        />
        <StatCard
          label="Active"
          value={loadingMissions ? '...' : String(activeMissions.length)}
          color="text-blue-400"
        />
        <StatCard
          label="Sessions"
          value={String(sessions.length)}
        />
      </div>

      {/* Level Progression */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Level Progression</h3>
        <AgentLevelDetail agentId={agent.id} />
      </section>

      {/* Mission History */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">
          Mission History ({missions.length})
        </h3>
        {loadingMissions ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : missions.length === 0 ? (
          <p className="text-sm text-zinc-600 italic">No missions found for this agent.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {missions.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/30 rounded-lg"
              >
                <StatusDot status={m.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{m.title}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(m.created_at).toLocaleDateString()}
                    {m.completed_at && ` — ${new Date(m.completed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[m.status] ?? 'bg-zinc-700 text-zinc-400'}`}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Violations */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4">Guardrail Violations</h3>
        <ViolationsFeed agentId={agent.id} limit={10} />
      </section>

      {/* Key Metrics */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Agent Profile</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Provider</p>
            <p className="text-zinc-300 mt-0.5">{agent.provider}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Model</p>
            <p className="text-zinc-300 mt-0.5">{agent.model}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">SOUL Version</p>
            <p className="text-zinc-300 mt-0.5">v{agent.soulVersion}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Lifecycle</p>
            <p className="text-zinc-300 mt-0.5 capitalize">{agent.lifecycleStatus}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/20 text-emerald-400',
  done: 'bg-emerald-500/20 text-emerald-400',
  active: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  pending: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-zinc-500/20 text-zinc-400',
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'completed' || status === 'done'
      ? 'bg-emerald-500'
      : status === 'active' || status === 'in_progress'
      ? 'bg-blue-500'
      : status === 'failed'
      ? 'bg-red-500'
      : 'bg-zinc-500';
  return <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />;
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color ?? 'text-zinc-200'}`}>{value}</p>
    </div>
  );
}
