interface TabHeaderProps {
  count: number;
  noun: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function TabHeader({ count, noun, actionLabel, onAction }: TabHeaderProps) {
  const plural = count !== 1 ? `${noun}s` : noun;
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs text-zinc-500">{count} {plural}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
        >
          + {actionLabel}
        </button>
      )}
    </div>
  );
}
