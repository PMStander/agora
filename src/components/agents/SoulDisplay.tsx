import { useState } from 'react';
import type { SoulProfile } from '../../types/supabase';
import { cn } from '../../lib/utils';

interface SoulDisplayProps {
  soul: SoulProfile;
}

function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <svg
          className={cn('w-4 h-4 transition-transform text-zinc-500', open ? 'rotate-0' : '-rotate-90')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>{title}</span>
        {badge && <span className="ml-auto text-xs text-zinc-500">{badge}</span>}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function SoulDisplay({ soul }: SoulDisplayProps) {
  return (
    <div className="divide-y divide-zinc-800">
      <CollapsibleSection title="Origin" defaultOpen>
        <p className="text-sm text-zinc-400 leading-relaxed">{soul.origin}</p>
      </CollapsibleSection>

      <CollapsibleSection title="Philosophy" badge={`${soul.philosophy.length}`} defaultOpen>
        <ul className="space-y-1.5">
          {soul.philosophy.map((p, i) => (
            <li key={i} className="text-sm text-zinc-400 flex gap-2">
              <span className="text-amber-500/60 shrink-0">-</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Inspirations" badge={`${soul.inspirations.length}`}>
        <ul className="space-y-2">
          {soul.inspirations.map((insp, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium text-zinc-300">{insp.name}</span>
              <span className="text-zinc-500"> - {insp.relationship}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Communication Style">
        <div className="space-y-2 text-sm">
          <p className="text-zinc-400">{soul.communicationStyle.tone}</p>
          <div className="flex gap-3">
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs">
              {soul.communicationStyle.formality}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs">
              {soul.communicationStyle.verbosity}
            </span>
          </div>
          {soul.communicationStyle.quirks.length > 0 && (
            <ul className="space-y-1 mt-2">
              {soul.communicationStyle.quirks.map((q, i) => (
                <li key={i} className="text-zinc-500 flex gap-2">
                  <span className="text-zinc-600 shrink-0">-</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Constraints" badge={`${soul.neverDos.length} rules`}>
        <ul className="space-y-1.5">
          {soul.neverDos.map((n, i) => (
            <li key={i} className="text-sm text-red-400/70 flex gap-2">
              <span className="shrink-0">NEVER:</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Workflows" badge={`${soul.preferredWorkflows.length}`}>
        <ul className="space-y-1.5">
          {soul.preferredWorkflows.map((w, i) => (
            <li key={i} className="text-sm text-zinc-400 flex gap-2">
              <span className="text-zinc-600 shrink-0">{i + 1}.</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {soul.additionalNotes && (
        <CollapsibleSection title="Additional Notes">
          <p className="text-sm text-zinc-400 whitespace-pre-wrap">{soul.additionalNotes}</p>
        </CollapsibleSection>
      )}
    </div>
  );
}
