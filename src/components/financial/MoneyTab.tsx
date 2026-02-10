import { lazy, Suspense } from 'react';
import { useFinancialStore, type FinancialSubTab } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';

const FinancialDashboard = lazy(() => import('./FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const IncomeList = lazy(() => import('./IncomeList').then(m => ({ default: m.IncomeList })));
const ExpenseList = lazy(() => import('./ExpenseList').then(m => ({ default: m.ExpenseList })));
const AccountList = lazy(() => import('./AccountList').then(m => ({ default: m.AccountList })));
const TaxRatesPanel = lazy(() => import('./TaxRatesPanel').then(m => ({ default: m.TaxRatesPanel })));

const SUB_TABS: { id: FinancialSubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'income',    label: 'Income',    icon: '↓' },
  { id: 'expenses',  label: 'Expenses',  icon: '↑' },
  { id: 'accounts',  label: 'Accounts',  icon: '🏦' },
  { id: 'tax',       label: 'Tax Rates', icon: '📋' },
];

export function MoneyTab() {
  // Initialize data fetching + realtime subscriptions
  useFinancial();

  const activeSubTab = useFinancialStore((s) => s.activeSubTab);
  const setActiveSubTab = useFinancialStore((s) => s.setActiveSubTab);

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`
              px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
              ${activeSubTab === tab.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }
            `}
          >
            {tab.icon} {tab.label}
          </button>
        ))}

        {/* Disclaimer */}
        <div className="ml-auto">
          <span className="text-xs text-zinc-600 italic">
            Financial insights for business planning
          </span>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading...</div>}>
          {activeSubTab === 'dashboard' && <FinancialDashboard />}
          {activeSubTab === 'income' && <IncomeList />}
          {activeSubTab === 'expenses' && <ExpenseList />}
          {activeSubTab === 'accounts' && <AccountList />}
          {activeSubTab === 'tax' && <TaxRatesPanel />}
        </Suspense>
      </div>
    </div>
  );
}
