import { useFinancialStore } from '../../stores/financial';
import type { FinancialContext } from '../../types/financial';

const CONTEXTS: { id: FinancialContext | 'all'; label: string; icon: string; color: string }[] = [
  { id: 'all',      label: 'All',      icon: '◉', color: 'amber' },
  { id: 'business', label: 'Business', icon: '💼', color: 'blue' },
  { id: 'personal', label: 'Personal', icon: '👤', color: 'green' },
];

export function ContextToggle() {
  const financialContext = useFinancialStore((s) => s.financialContext);
  const setFinancialContext = useFinancialStore((s) => s.setFinancialContext);

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-zinc-800/50 p-0.5">
      {CONTEXTS.map((ctx) => {
        const isActive = financialContext === ctx.id;
        const colorMap: Record<string, string> = {
          amber: 'bg-amber-500/20 text-amber-400',
          blue: 'bg-blue-500/20 text-blue-400',
          green: 'bg-green-500/20 text-green-400',
        };

        return (
          <button
            key={ctx.id}
            onClick={() => setFinancialContext(ctx.id)}
            className={`
              px-2.5 py-1 text-xs font-medium rounded-md transition-colors
              ${isActive ? colorMap[ctx.color] : 'text-zinc-500 hover:text-zinc-300'}
            `}
          >
            {ctx.icon} {ctx.label}
          </button>
        );
      })}
    </div>
  );
}
