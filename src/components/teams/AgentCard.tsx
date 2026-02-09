import { useAgentStore, type Agent } from '../../stores/agents';
import { LevelBadge } from '../agents/LevelBadge';
import type { AgentLifecycleStatus } from '../../types/supabase';

const LIFECYCLE_DOT: Record<AgentLifecycleStatus, string> = {
  active: 'bg-green-400',
  onboarding: 'bg-blue-400',
  candidate: 'bg-zinc-400',
  suspended: 'bg-amber-400',
  retired: 'bg-red-400',
};

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const profile = useAgentStore((s) => s.agentProfiles[agent.id]);
  const setSelectedProfileAgentId = useAgentStore((s) => s.setSelectedProfileAgentId);

  if (!profile) return null;

  const originExcerpt = profile.soul.origin.length > 80
    ? profile.soul.origin.slice(0, 80) + '...'
    : profile.soul.origin;

  const traitTags = [
    profile.soul.communicationStyle.formality,
    profile.soul.philosophy[0]?.split(' ').slice(0, 4).join(' '),
  ].filter(Boolean);

  const dotColor = LIFECYCLE_DOT[profile.lifecycleStatus] || 'bg-zinc-400';

  return (
    <button
      onClick={() => setSelectedProfileAgentId(agent.id)}
      className="group w-full text-left p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <span className="text-2xl">{agent.emoji}</span>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${dotColor}`}
            title={profile.lifecycleStatus}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-zinc-100 truncate">
              {agent.name}
            </h4>
            <LevelBadge level={profile.soul.communicationStyle.formality === 'formal' ? 3 : 2} />
          </div>
          <p className="text-xs text-zinc-400">{agent.role}</p>
          <p className="text-[11px] text-zinc-600 italic mt-0.5">{agent.persona}</p>
        </div>
      </div>

      {/* Origin excerpt */}
      <p className="mt-2 text-xs text-zinc-500 line-clamp-2">
        {originExcerpt}
      </p>

      {/* Trait tags */}
      {traitTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {traitTags.map((tag, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[10px] rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
