import React, { lazy, Suspense } from 'react';
import { useFinancialStore, type FinancialSubTab } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';
import { ContextToggle } from './ContextToggle';

const FinancialDashboard = lazy(() => import('./FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const IncomeList = lazy(() => import('./IncomeList').then(m => ({ default: m.IncomeList })));
const ExpenseList = lazy(() => import('./ExpenseList').then(m => ({ default: m.ExpenseList })));
const AccountList = lazy(() => import('./AccountList').then(m => ({ default: m.AccountList })));
const BudgetsTab = lazy(() => import('./BudgetsTab').then(m => ({ default: m.BudgetsTab })));
const GoalsTab = lazy(() => import('./GoalsTab').then(m => ({ default: m.GoalsTab })));
const RecurringTab = lazy(() => import('./RecurringTab').then(m => ({ default: m.RecurringTab })));
const CashFlowForecast = lazy(() => import('./CashFlowForecast').then(m => ({ default: m.CashFlowForecast })));
const TaxRatesPanel = lazy(() => import('./TaxRatesPanel').then(m => ({ default: m.TaxRatesPanel })));

const SUB_TABS: { id: FinancialSubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
  { id: 'income',    label: 'Income',    icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg> },
  { id: 'expenses',  label: 'Expenses',  icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg> },
  { id: 'accounts',  label: 'Accounts',  icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg> },
  { id: 'budgets',   label: 'Budgets',   icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5l3 4.5m0 0l3-4.5M12 12v5.25M15 12H9m6 3H9m12-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'goals',     label: 'Goals',     icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg> },
  { id: 'recurring', label: 'Recurring', icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" /></svg> },
  { id: 'forecast',  label: 'Forecast',  icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg> },
  { id: 'tax',       label: 'Tax Rates', icon: <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" /></svg> },
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
          <div key={tab.id} className="relative group">
            <button
              onClick={() => setActiveSubTab(tab.id)}
              className={`
                p-2 rounded-lg transition-colors
                ${activeSubTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              {tab.icon}
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-1 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              {tab.label}
            </div>
          </div>
        ))}

        {/* Spacer + Context Toggle + Disclaimer */}
        <div className="ml-auto flex items-center gap-3">
          <ContextToggle />
          <span className="text-xs text-zinc-600 italic">
            Financial insights for planning
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
          {activeSubTab === 'budgets' && <BudgetsTab />}
          {activeSubTab === 'goals' && <GoalsTab />}
          {activeSubTab === 'recurring' && <RecurringTab />}
          {activeSubTab === 'forecast' && <CashFlowForecast />}
          {activeSubTab === 'tax' && <TaxRatesPanel />}
        </Suspense>
      </div>
    </div>
  );
}
