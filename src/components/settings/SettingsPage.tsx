import { useState } from 'react';
import { GeneralSettings } from './GeneralSettings';
import { SlashCommandsSettings } from './SlashCommandsSettings';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

export type SettingsTab = 'general' | 'slash-commands';

export function SettingsPage({ isOpen, onClose, initialTab = 'general' }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex">
        {/* Navigation Sidebar */}
        <div className="w-64 border-r border-border bg-muted/30">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Settings</h2>
          </div>
          
          <nav className="p-4 space-y-1">
            <TabButton
              icon="⚙️"
              label="General"
              isActive={activeTab === 'general'}
              onClick={() => setActiveTab('general')}
            />
            <TabButton
              icon="⚡"
              label="Slash Commands"
              isActive={activeTab === 'slash-commands'}
              onClick={() => setActiveTab('slash-commands')}
            />
            {/* Future tabs can be added here */}
            {/* 
            <TabButton
              icon="🔌"
              label="Integrations"
              isActive={activeTab === 'integrations'}
              onClick={() => setActiveTab('integrations')}
            />
            <TabButton
              icon="🎨"
              label="Appearance"
              isActive={activeTab === 'appearance'}
              onClick={() => setActiveTab('appearance')}
            />
            */}
          </nav>

          {/* Close button at bottom of sidebar */}
          <div className="absolute bottom-4 left-4 right-4 px-2">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close Settings
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-medium text-foreground">
              {activeTab === 'general' && '⚙️ General Settings'}
              {activeTab === 'slash-commands' && '⚡ Slash Commands'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Close settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'slash-commands' && <SlashCommandsSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
        isActive
          ? 'bg-accent text-background font-medium'
          : 'text-foreground hover:bg-muted'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
