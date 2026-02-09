export function HireAgentButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                 border border-dashed border-amber-500/40 text-amber-500/70
                 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/5
                 transition-colors text-sm"
    >
      <span>+</span>
      <span>Hire New Agent</span>
    </button>
  );
}
