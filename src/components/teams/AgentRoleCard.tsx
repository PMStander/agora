import { useAgentStore } from '../../stores/agents';
import { LevelBadge } from '../agents/LevelBadge';
import type { AgentLifecycleStatus } from '../../types/supabase';

const LIFECYCLE_BADGE: Record<AgentLifecycleStatus, { bg: string; text: string }> = {
  candidate: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  onboarding: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  active: { bg: 'bg-green-500/20', text: 'text-green-400' },
  suspended: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
  retired: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

export function AgentRoleCard() {
  const selectedId = useAgentStore((s) => s.selectedProfileAgentId);
  const profile = useAgentStore((s) => (selectedId ? s.agentProfiles[selectedId] : null));
  const setSelectedProfileAgentId = useAgentStore((s) => s.setSelectedProfileAgentId);

  if (!profile) return null;

  const badge = LIFECYCLE_BADGE[profile.lifecycleStatus];
  const soul = profile.soul;

  return (
    <div className="h-full flex flex-col overflow-hidden border-l border-zinc-800 bg-zinc-900/50 w-80">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setSelectedProfileAgentId(null)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Close
          </button>
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
            {profile.lifecycleStatus}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-3xl">{profile.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-100">{profile.name}</h3>
              <LevelBadge level={soul.communicationStyle.formality === 'formal' ? 3 : 2} />
            </div>
            <p className="text-sm text-zinc-400">{profile.role}</p>
            <p className="text-xs text-zinc-500 italic">{profile.persona}</p>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Origin */}
        <Section title="Origin">
          <p className="text-xs text-zinc-400 leading-relaxed">{soul.origin}</p>
        </Section>

        {/* Domains */}
        {profile.domains.length > 0 && (
          <Section title="Domains">
            <TagList items={profile.domains.map((d) => `${d.domain} (${d.depth})`)} />
          </Section>
        )}

        {/* Philosophy */}
        {soul.philosophy.length > 0 && (
          <Section title="Philosophy">
            <ul className="space-y-1">
              {soul.philosophy.map((p, i) => (
                <li key={i} className="text-xs text-zinc-400 flex gap-2">
                  <span className="text-zinc-600 shrink-0">•</span>
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Communication Style */}
        <Section title="Communication">
          <div className="space-y-2 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span className="text-zinc-500">Tone</span>
              <span className="text-right max-w-[60%]">{soul.communicationStyle.tone.slice(0, 60)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Formality</span>
              <span className="capitalize">{soul.communicationStyle.formality}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Verbosity</span>
              <span className="capitalize">{soul.communicationStyle.verbosity}</span>
            </div>
            {soul.communicationStyle.quirks.length > 0 && (
              <div className="pt-1">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Quirks</span>
                <ul className="mt-1 space-y-0.5">
                  {soul.communicationStyle.quirks.map((q, i) => (
                    <li key={i} className="text-xs text-zinc-400 flex gap-2">
                      <span className="text-zinc-600 shrink-0">✦</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>

        {/* Inputs: Preferred Workflows */}
        {soul.preferredWorkflows.length > 0 && (
          <Section title="Preferred Workflows">
            <ul className="space-y-1">
              {soul.preferredWorkflows.map((w, i) => (
                <li key={i} className="text-xs text-zinc-400 flex gap-2">
                  <span className="text-zinc-600 shrink-0">→</span>
                  {w}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Hard Bans */}
        {soul.neverDos.length > 0 && (
          <Section title="Hard Bans">
            <ul className="space-y-1">
              {soul.neverDos.map((n, i) => (
                <li key={i} className="text-xs text-red-400/80 flex gap-2">
                  <span className="shrink-0">✕</span>
                  {n}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Skills */}
        {profile.skills.length > 0 && (
          <Section title="Skills">
            <TagList items={profile.skills} />
          </Section>
        )}

        {/* Provider / Model */}
        <Section title="Provider / Model">
          <div className="text-xs text-zinc-400 space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Provider</span>
              <span className="capitalize">{profile.provider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Model</span>
              <span>{profile.model}</span>
            </div>
          </div>
        </Section>

        {/* Inspirations */}
        {soul.inspirations && soul.inspirations.length > 0 && (
          <Section title="Inspirations">
            <ul className="space-y-1">
              {soul.inspirations.map((ins, i) => (
                <li key={i} className="text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">{ins.name}</span>
                  <span className="text-zinc-500"> — {ins.relationship}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span
          key={i}
          className="px-1.5 py-0.5 text-[10px] rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
