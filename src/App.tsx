import { useState, useEffect, lazy, Suspense } from 'react';
import { AgentSidebar } from './components/agents/AgentSidebar';
import { ChatPanel } from './components/chat/ChatPanel';
import { ContextPanel } from './components/layout/ContextPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { HireAgentWizard } from './components/agents/HireAgentWizard';
import { AgentProfilePanel } from './components/agents/AgentProfilePanel';
import { MissionControlTab } from './components/mission-control/MissionControlTab';
import { MissionLifecyclePanel } from './components/mission-control/MissionLifecyclePanel';
import { TaskDetail } from './components/mission-control/TaskDetail';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { useMissionScheduler } from './hooks/useMissionScheduler';
import { useMissionControlStore, useSelectedMission, useSelectedTask } from './stores/missionControl';
import { useAgentStore } from './stores/agents';
import { useSelectedContact, useSelectedCompany, useSelectedDeal } from './stores/crm';
import { useSelectedQuote, useSelectedInvoice } from './stores/invoicing';
import { useSelectedEvent } from './stores/calendar';
import { addRetroactiveProof, addRetroactiveProofToAll } from './lib/retroactiveProof';
import { NotificationBell } from './components/notifications/NotificationBell';
import { NotificationToast } from './components/notifications/NotificationToast';

// Lazy-load new tabs
const CrmTab = lazy(() => import('./components/crm/CrmTab').then(m => ({ default: m.CrmTab })));
const ProductsTab = lazy(() => import('./components/products/ProductsTab').then(m => ({ default: m.ProductsTab })));
const ProjectsTab = lazy(() => import('./components/projects/ProjectsTab').then(m => ({ default: m.ProjectsTab })));
const ReportsTab = lazy(() => import('./components/reports/ReportsTab').then(m => ({ default: m.ReportsTab })));
const PerformanceReviewPage = lazy(() => import('./components/reviews/PerformanceReviewPage').then(m => ({ default: m.PerformanceReviewPage })));
const ContextTab = lazy(() => import('./components/context/ContextTab').then(m => ({ default: m.ContextTab })));
const WorkflowsTab = lazy(() => import('./components/workflows/WorkflowsTab').then(m => ({ default: m.WorkflowsTab })));
const CalendarTab = lazy(() => import('./components/calendar/CalendarTab').then(m => ({ default: m.CalendarTab })));

// Lazy-load CRM detail panels
const ContactDetail = lazy(() => import('./components/crm/ContactDetail').then(m => ({ default: m.ContactDetail })));
const CompanyDetail = lazy(() => import('./components/crm/CompanyDetail').then(m => ({ default: m.CompanyDetail })));
const DealDetail = lazy(() => import('./components/crm/DealDetail').then(m => ({ default: m.DealDetail })));
const QuoteDetail = lazy(() => import('./components/invoicing/QuoteDetail').then(m => ({ default: m.QuoteDetail })));
const InvoiceDetail = lazy(() => import('./components/invoicing/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const EventDetail = lazy(() => import('./components/calendar/EventDetail').then(m => ({ default: m.EventDetail })));

function App() {
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeTab = useMissionControlStore((s) => s.activeTab);
  const setActiveTab = useMissionControlStore((s) => s.setActiveTab);
  const selectedMission = useSelectedMission();
  const selectedTask = useSelectedTask();
  const selectedContact = useSelectedContact();
  const selectedCompany = useSelectedCompany();
  const selectedDeal = useSelectedDeal();
  const selectedQuote = useSelectedQuote();
  const selectedInvoice = useSelectedInvoice();
  const selectedCalendarEvent = useSelectedEvent();
  const selectedProfileAgentId = useAgentStore((s) => s.selectedProfileAgentId);
  
  // Initialize theme
  useTheme();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();
  // Background mission scheduler/runner
  useMissionScheduler();

  // Dev utilities: Expose proof utilities to window for manual retroactive fixes
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).agoraDevUtils = {
        addRetroactiveProof,
        addRetroactiveProofToAll,
        getMissions: () => useMissionControlStore.getState().missions,
        getTasks: () => useMissionControlStore.getState().tasks,
      };
      console.log('[Agora] Dev utilities available at window.agoraDevUtils');
      console.log('  - addRetroactiveProof(missionId): Add proof to a specific mission');
      console.log('  - addRetroactiveProofToAll(): Add proof to all completed missions');
      console.log('  - getMissions(): Get all missions');
      console.log('  - getTasks(): Get all tasks');
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Settings (Cmd+,)
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
      // Escape to close settings
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
      // Tab switching (Cmd+1-5)
      if (e.metaKey && e.key === '1') {
        e.preventDefault();
        setActiveTab('chat');
      }
      if (e.metaKey && e.key === '2') {
        e.preventDefault();
        setActiveTab('mission-control');
      }
      if (e.metaKey && e.key === '3') {
        e.preventDefault();
        setActiveTab('crm');
      }
      if (e.metaKey && e.key === '4') {
        e.preventDefault();
        setActiveTab('products');
      }
      if (e.metaKey && e.key === '5') {
        e.preventDefault();
        setActiveTab('projects');
      }
      if (e.metaKey && e.key === '6') {
        e.preventDefault();
        setActiveTab('reports');
      }
      if (e.metaKey && e.key === '7') {
        e.preventDefault();
        setActiveTab('reviews');
      }
      if (e.metaKey && e.key === '8') {
        e.preventDefault();
        setActiveTab('context');
      }
      if (e.metaKey && e.key === '9') {
        e.preventDefault();
        setActiveTab('automation');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, setActiveTab]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Agent Sidebar */}
        <AgentSidebar onSettingsClick={() => setSettingsOpen(true)} />
        
        {/* Center: Main Content with Tab Switcher */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
            <button
              onClick={() => setActiveTab('chat')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'chat'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab('mission-control')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'mission-control'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              🏛️ Missions
            </button>
            <button
              onClick={() => setActiveTab('crm')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'crm'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              👤 CRM
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'products'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              📦 Products
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'projects'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              📊 Projects
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'reports'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              📈 Reports
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'reviews'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              📋 Reviews
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'context'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              📄 Context
            </button>
            <button
              onClick={() => setActiveTab('automation')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'automation'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              ⚡ Automation
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'calendar'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              📅 Calendar
            </button>
            <div className="flex-1" />
            <NotificationBell />
            <span className="text-xs text-zinc-600">⌘1-9</span>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && <ChatPanel />}
            {activeTab === 'mission-control' && <MissionControlTab />}
            {activeTab === 'crm' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading CRM...</div>}>
                <CrmTab />
              </Suspense>
            )}
            {activeTab === 'products' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Products...</div>}>
                <ProductsTab />
              </Suspense>
            )}
            {activeTab === 'projects' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Projects...</div>}>
                <ProjectsTab />
              </Suspense>
            )}
            {activeTab === 'reports' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Reports...</div>}>
                <ReportsTab />
              </Suspense>
            )}
            {activeTab === 'reviews' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Reviews...</div>}>
                <PerformanceReviewPage />
              </Suspense>
            )}
            {activeTab === 'context' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Context...</div>}>
                <ContextTab />
              </Suspense>
            )}
            {activeTab === 'automation' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Automation...</div>}>
                <WorkflowsTab />
              </Suspense>
            )}
            {activeTab === 'calendar' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Calendar...</div>}>
                <CalendarTab />
              </Suspense>
            )}
          </div>
        </div>
        
        {/* Right: Context Panel (detail panels for Mission Control, CRM, and Agent Profile) */}
        {selectedProfileAgentId ? (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50">
            <AgentProfilePanel />
          </div>
        ) : activeTab === 'mission-control' && selectedTask ? (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50">
            <TaskDetail />
          </div>
        ) : activeTab === 'mission-control' && selectedMission ? (
          <div className="w-96 border-l border-zinc-800 bg-zinc-900/50">
            <MissionLifecyclePanel />
          </div>
        ) : activeTab === 'crm' && selectedDeal ? (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50">
            <Suspense fallback={null}>
              <DealDetail />
            </Suspense>
          </div>
        ) : activeTab === 'crm' && selectedContact ? (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50">
            <Suspense fallback={null}>
              <ContactDetail />
            </Suspense>
          </div>
        ) : activeTab === 'crm' && selectedCompany ? (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50">
            <Suspense fallback={null}>
              <CompanyDetail />
            </Suspense>
          </div>
        ) : activeTab === 'crm' && selectedQuote ? (
          <Suspense fallback={null}>
            <QuoteDetail onEdit={() => {}} />
          </Suspense>
        ) : activeTab === 'crm' && selectedInvoice ? (
          <Suspense fallback={null}>
            <InvoiceDetail onEdit={() => {}} />
          </Suspense>
        ) : activeTab === 'calendar' && selectedCalendarEvent ? (
          <Suspense fallback={null}>
            <EventDetail />
          </Suspense>
        ) : (
          <ContextPanel
            isOpen={contextPanelOpen}
            onToggle={() => setContextPanelOpen(!contextPanelOpen)}
          />
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />
      
      {/* Settings Modal */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Hire Agent Wizard Modal */}
      <HireAgentWizard />

      {/* Notification Toasts (fixed position, always mounted) */}
      <NotificationToast />
    </div>
  );
}

export default App;
