interface ProfileEmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ProfileEmptyState({ message, actionLabel, onAction }: ProfileEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
      <p className="text-sm text-zinc-500 mb-3">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-3 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
