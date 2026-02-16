import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { AgentSidebar } from './components/agents/AgentSidebar';
import { ChatPanel } from './components/chat/ChatPanel';
import { ContextPanel } from './components/layout/ContextPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsPage } from './components/settings';
import { HireAgentWizard } from './components/agents/HireAgentWizard';
import { AgentProfilePanel } from './components/agents/AgentProfilePanel';
import { MissionControlTab } from './components/mission-control/MissionControlTab';
import { MissionLifecyclePanel } from './components/mission-control/MissionLifecyclePanel';
import { TaskDetail } from './components/mission-control/TaskDetail';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { useMissionScheduler } from './hooks/useMissionScheduler';
// Disabled until entity_embeddings migration is re-enabled
// import { useEmbeddingQueueProcessor } from './hooks/useEmbeddingQueueProcessor';
import { useMissionControlStore, useSelectedMission, useSelectedTask } from './stores/missionControl';
import { useAgentStore } from './stores/agents';
import { useCrmStore, useSelectedContact, useSelectedCompany, useSelectedDeal } from './stores/crm';
import { useSelectedQuote, useSelectedInvoice } from './stores/invoicing';
import { useSelectedEvent } from './stores/calendar';
import { useSelectedTransaction } from './stores/financial';
import { addRetroactiveProof, addRetroactiveProofToAll } from './lib/retroactiveProof';
import { useDocumentCenterStore } from './stores/documentCenter';
import { NotificationBell } from './components/notifications/NotificationBell';
import { NotificationToast } from './components/notifications/NotificationToast';
import { SupabaseHealthBanner } from './components/layout/SupabaseHealthBanner';
import { GatewayHealthBanner } from './components/layout/GatewayHealthBanner';

// Lazy-load new tabs
const CrmTab = lazy(() => import('./components/crm/CrmTab').then(m => ({ default: m.CrmTab })));
const ProductsTab = lazy(() => import('./components/products/ProductsTab').then(m => ({ default: m.ProductsTab })));
const ProjectsTab = lazy(() => import('./components/projects/ProjectsTab').then(m => ({ default: m.ProjectsTab })));
const ReportsTab = lazy(() => import('./components/reports/ReportsTab').then(m => ({ default: m.ReportsTab })));
const PerformanceReviewPage = lazy(() => import('./components/reviews/PerformanceReviewPage').then(m => ({ default: m.PerformanceReviewPage })));
const ContextTab = lazy(() => import('./components/context/ContextTab').then(m => ({ default: m.ContextTab })));
const WorkflowsTab = lazy(() => import('./components/workflows/WorkflowsTab').then(m => ({ default: m.WorkflowsTab })));
const CalendarTab = lazy(() => import('./components/calendar/CalendarTab').then(m => ({ default: m.CalendarTab })));
const TeamsTab = lazy(() => import('./components/teams/TeamsTab').then(m => ({ default: m.TeamsTab })));
const AgentWorkspace = lazy(() => import('./components/agents/workspace/AgentWorkspace').then(m => ({ default: m.AgentWorkspace })));
const MoneyTab = lazy(() => import('./components/financial/MoneyTab').then(m => ({ default: m.MoneyTab })));
const DocumentCenterTab = lazy(() => import('./components/document-center').then(m => ({ default: m.DocumentCenterTab })));
const DocumentDetailPanel = lazy(() => import('./components/document-center').then(m => ({ default: m.DocumentDetailPanel })));
const CrmProfileWorkspace = lazy(() => import('./components/crm/profile').then(m => ({ default: m.CrmProfileWorkspace })));

// Lazy-load CRM detail panels
const ContactDetail = lazy(() => import('./components/crm/ContactDetail').then(m => ({ default: m.ContactDetail })));
const CompanyDetail = lazy(() => import('./components/crm/CompanyDetail').then(m => ({ default: m.CompanyDetail })));
const DealDetail = lazy(() => import('./components/crm/DealDetail').then(m => ({ default: m.DealDetail })));
const QuoteDetail = lazy(() => import('./components/invoicing/QuoteDetail').then(m => ({ default: m.QuoteDetail })));
const InvoiceDetail = lazy(() => import('./components/invoicing/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const EventDetail = lazy(() => import('./components/calendar/EventDetail').then(m => ({ default: m.EventDetail })));
const AgentRoleCard = lazy(() => import('./components/teams/AgentRoleCard').then(m => ({ default: m.AgentRoleCard })));
const TransactionDetail = lazy(() => import('./components/financial/TransactionDetail').then(m => ({ default: m.TransactionDetail })));

function App() {
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
  const selectedTransaction = useSelectedTransaction();
  const selectedProfileAgentId = useAgentStore((s) => s.selectedProfileAgentId);
  const selectedWorkspaceAgentId = useAgentStore((s) => s.selectedWorkspaceAgentId);
  const selectedDocumentId = useDocumentCenterStore((s) => s.selectedDocumentId);
  const profileWorkspaceEntityId = useCrmStore((s) => s.profileWorkspaceEntityId);
  
  // Initialize theme
  useTheme();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();
  // Background mission scheduler/runner
  useMissionScheduler();
  // Disabled until entity_embeddings migration is re-enabled
  // useEmbeddingQueueProcessor();

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Settings (Cmd+,)
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
      // Escape to close settings or dropdown
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
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
      if (e.metaKey && e.key === '0') {
        e.preventDefault();
        setActiveTab('money');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, dropdownOpen, setActiveTab]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Health banners */}
      <SupabaseHealthBanner />
      <GatewayHealthBanner />
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Agent Sidebar */}
        <AgentSidebar onSettingsClick={() => setSettingsOpen(true)} />
        
        {/* Center: Main Content with Tab Switcher */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
            {/* Primary Navigation: Chat & Missions */}
            <button
              onClick={() => setActiveTab('chat')}
              className={`
                flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'chat'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </button>
            <button
              onClick={() => setActiveTab('mission-control')}
              className={`
                flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'mission-control'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                <line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              Missions
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`
                flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'teams'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Teams
            </button>
            <button
              onClick={() => setActiveTab('money')}
              className={`
                flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'money'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Money
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`
                flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${activeTab === 'documents'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Docs
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right Side: More Dropdown + Notifications */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="19" cy="12" r="1"/>
                  <circle cx="5" cy="12" r="1"/>
                </svg>
                More
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={() => {
                      setActiveTab('crm');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'crm'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    CRM
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('products');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'products'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    Products
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('projects');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'projects'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    Projects
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('reports');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'reports'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    Reports
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('reviews');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'reviews'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M9 11l3 3L22 4"/>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    Reviews
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('context');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'context'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Context
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('automation');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'automation'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    Automation
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('calendar');
                      setDropdownOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                      ${activeTab === 'calendar'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                      }
                    `}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Calendar
                  </button>
                </div>
              )}
            </div>

            <NotificationBell />
            <span className="text-xs text-zinc-600">⌘0-9</span>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && <ChatPanel />}
            {activeTab === 'mission-control' && <MissionControlTab />}
            {activeTab === 'crm' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading CRM...</div>}>
                {profileWorkspaceEntityId ? <CrmProfileWorkspace /> : <CrmTab />}
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
            {activeTab === 'teams' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Teams...</div>}>
                {selectedWorkspaceAgentId ? <AgentWorkspace /> : <TeamsTab />}
              </Suspense>
            )}
            {activeTab === 'money' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Money...</div>}>
                <MoneyTab />
              </Suspense>
            )}
            {activeTab === 'documents' && (
              <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500">Loading Documents...</div>}>
                <DocumentCenterTab />
              </Suspense>
            )}
          </div>
        </div>
        
        {/* Right: Context Panel (detail panels for Mission Control, CRM, and Agent Profile) */}
        {activeTab === 'teams' && selectedProfileAgentId ? (
          <Suspense fallback={null}>
            <AgentRoleCard />
          </Suspense>
        ) : selectedProfileAgentId ? (
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
        ) : activeTab === 'money' && selectedTransaction ? (
          <Suspense fallback={null}>
            <TransactionDetail />
          </Suspense>
        ) : activeTab === 'calendar' && selectedCalendarEvent ? (
          <Suspense fallback={null}>
            <EventDetail />
          </Suspense>
        ) : activeTab === 'documents' && selectedDocumentId ? (
          <Suspense fallback={null}>
            <DocumentDetailPanel />
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
      
      {/* Settings Page */}
      <SettingsPage
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
