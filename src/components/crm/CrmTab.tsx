import { lazy, Suspense, useState } from 'react';
import { useCrmStore } from '../../stores/crm';
import { useCRM } from '../../hooks/useCRM';
import { useSavedViews } from '../../hooks/useSavedViews';
import { ContactList } from './ContactList';
import { CompanyList } from './CompanyList';
import { DealPipeline } from './DealPipeline';
import { InteractionTimeline } from './InteractionTimeline';
import { SavedViewsSidebar } from './SavedViewsSidebar';
import { SAVED_VIEW_COLORS } from '../../types/crm';

const InvoicingTab = lazy(() => import('../invoicing/InvoicingTab').then(m => ({ default: m.InvoicingTab })));

const SUB_TABS = [
  { id: 'contacts', label: 'Contacts', emoji: '👤' },
  { id: 'companies', label: 'Companies', emoji: '🏢' },
  { id: 'deals', label: 'Deals', emoji: '💰' },
  { id: 'interactions', label: 'Interactions', emoji: '📞' },
  { id: 'quotes', label: 'Quotes', emoji: '📋' },
  { id: 'invoices', label: 'Invoices', emoji: '📄' },
] as const;

export function CrmTab() {
  // Initialize data fetching + realtime subscriptions
  useCRM();
  const { activeView, clearActiveView } = useSavedViews();

  const activeSubTab = useCrmStore((s) => s.activeSubTab);
  const setActiveSubTab = useCrmStore((s) => s.setActiveSubTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeViewColor = activeView?.color
    ? SAVED_VIEW_COLORS.find((c) => c.value === activeView.color)
    : null;

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
            {tab.emoji} {tab.label}
          </button>
        ))}

        {/* Active view indicator */}
        {activeView && (
          <div className="ml-auto flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                activeViewColor
                  ? `${activeViewColor.bg} ${activeViewColor.text}`
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {activeView.icon && <span>{activeView.icon}</span>}
              <span>{activeView.name}</span>
              <button
                onClick={clearActiveView}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                title="Clear view"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main content area with sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Saved views sidebar */}
        <SavedViewsSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Sub-tab content */}
        <div className="flex-1 overflow-hidden">
          {activeSubTab === 'contacts' && <ContactList />}
          {activeSubTab === 'companies' && <CompanyList />}
          {activeSubTab === 'deals' && <DealPipeline />}
          {activeSubTab === 'interactions' && <InteractionTimeline />}
          {(activeSubTab === 'quotes' || activeSubTab === 'invoices') && (
            <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading...</div>}>
              <InvoicingTab initialSubTab={activeSubTab} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
