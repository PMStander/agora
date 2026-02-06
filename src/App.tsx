import { useState, useEffect } from 'react';
import { AgentSidebar } from './components/agents/AgentSidebar';
import { ChatPanel } from './components/chat/ChatPanel';
import { ContextPanel } from './components/layout/ContextPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { MissionControlTab } from './components/mission-control/MissionControlTab';
import { TaskDetail } from './components/mission-control/TaskDetail';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { useMissionControlStore, useSelectedTask } from './stores/missionControl';

function App() {
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeTab = useMissionControlStore((s) => s.activeTab);
  const setActiveTab = useMissionControlStore((s) => s.setActiveTab);
  const selectedTask = useSelectedTask();
  
  // Initialize theme
  useTheme();
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

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
      // Tab switching (Cmd+1 for Chat, Cmd+2 for Mission Control)
      if (e.metaKey && e.key === '1') {
        e.preventDefault();
        setActiveTab('chat');
      }
      if (e.metaKey && e.key === '2') {
        e.preventDefault();
        setActiveTab('mission-control');
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
              🏛️ Mission Control
            </button>
            <div className="flex-1" />
            <span className="text-xs text-zinc-600">⌘1 / ⌘2</span>
          </div>
          
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' ? <ChatPanel /> : <MissionControlTab />}
          </div>
        </div>
        
        {/* Right: Context Panel (shows TaskDetail when task selected in Mission Control) */}
        {activeTab === 'mission-control' && selectedTask ? (
          <div className="w-80 border-l border-zinc-800 bg-zinc-900/50">
            <TaskDetail />
          </div>
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
    </div>
  );
}

export default App;
