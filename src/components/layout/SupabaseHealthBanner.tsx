import { useSupabaseHealth } from '../../hooks/useSupabaseHealth';

export function SupabaseHealthBanner() {
  const { reachable, error } = useSupabaseHealth();

  if (reachable) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <span>
        Database unavailable — data may not load or save.
        {error && <span className="text-red-500/70 ml-1">({error})</span>}
      </span>
    </div>
  );
}
