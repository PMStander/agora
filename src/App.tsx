import { useState, useEffect } from 'react';
import { AgentSidebar } from './components/agents/AgentSidebar';
import { ChatPanel } from './components/chat/ChatPanel';
import { ContextPanel } from './components/layout/ContextPanel';
import { StatusBar } from './components/layout/StatusBar';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';

function App() {
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Initialize theme
  useTheme();
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Keyboard shortcut for settings (Cmd+,)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Agent Sidebar */}
        <AgentSidebar onSettingsClick={() => setSettingsOpen(true)} />
        
        {/* Center: Chat */}
        <ChatPanel />
        
        {/* Right: Context Panel (A2UI, tools, etc.) */}
        <ContextPanel 
          isOpen={contextPanelOpen} 
          onToggle={() => setContextPanelOpen(!contextPanelOpen)} 
        />
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
