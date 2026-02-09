import { cn } from '../../lib/utils';
import type { AgentLevel } from '../../types/supabase';
import { AGENT_LEVEL_LABELS } from '../../types/supabase';

interface LevelBadgeProps {
  level: AgentLevel;
  size?: 'sm' | 'md';
}

const BADGE_COLORS: Record<AgentLevel, string> = {
  1: 'bg-zinc-700 text-zinc-300',
  2: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  3: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  4: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

export function LevelBadge({ level, size = 'sm' }: LevelBadgeProps) {
  const label = AGENT_LEVEL_LABELS[level] || 'Unknown';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium shrink-0',
        BADGE_COLORS[level],
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      )}
      title={label}
    >
      L{level}
    </span>
  );
}
