// ─── DuplicateBadge ─────────────────────────────────────────────────────────
// Small warning badge shown in the ContactList header when duplicates exist.

interface DuplicateBadgeProps {
  count: number;
  onClick: () => void;
}

export function DuplicateBadge({ count, onClick }: DuplicateBadgeProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:border-amber-500/50 transition-colors"
    >
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 1.5L14.5 13H1.5L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 6V9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="11" r="0.75" fill="currentColor" />
      </svg>
      {count} potential duplicate{count !== 1 ? 's' : ''} found
    </button>
  );
}
