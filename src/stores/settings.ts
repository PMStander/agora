import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'system';

interface SettingsState {
  // Appearance
  theme: Theme;
  accentColor: 'gold' | 'cyan' | 'purple' | 'green';
  compactMode: boolean;
  
  // Notifications
  notificationsEnabled: boolean;
  notifyOnAgentComplete: boolean;
  notifyOnMention: boolean;
  soundEnabled: boolean;
  
  // Behavior
  autoStartEnabled: boolean;
  minimizeToTray: boolean;
  showInMenuBar: boolean;
  
  // Voice
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  preferredVoice: string;
  
  // Actions
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: 'gold' | 'cyan' | 'purple' | 'green') => void;
  setCompactMode: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setNotifyOnAgentComplete: (enabled: boolean) => void;
  setNotifyOnMention: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setAutoStartEnabled: (enabled: boolean) => void;
  setMinimizeToTray: (enabled: boolean) => void;
  setShowInMenuBar: (enabled: boolean) => void;
  setVoiceInputEnabled: (enabled: boolean) => void;
  setVoiceOutputEnabled: (enabled: boolean) => void;
  setPreferredVoice: (voice: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      theme: 'dark',
      accentColor: 'gold',
      compactMode: false,
      notificationsEnabled: true,
      notifyOnAgentComplete: true,
      notifyOnMention: true,
      soundEnabled: true,
      autoStartEnabled: false,
      minimizeToTray: true,
      showInMenuBar: true,
      voiceInputEnabled: false,
      voiceOutputEnabled: false,
      preferredVoice: 'default',
      
      // Actions
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setCompactMode: (compactMode) => set({ compactMode }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotifyOnAgentComplete: (notifyOnAgentComplete) => set({ notifyOnAgentComplete }),
      setNotifyOnMention: (notifyOnMention) => set({ notifyOnMention }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setAutoStartEnabled: (autoStartEnabled) => set({ autoStartEnabled }),
      setMinimizeToTray: (minimizeToTray) => set({ minimizeToTray }),
      setShowInMenuBar: (showInMenuBar) => set({ showInMenuBar }),
      setVoiceInputEnabled: (voiceInputEnabled) => set({ voiceInputEnabled }),
      setVoiceOutputEnabled: (voiceOutputEnabled) => set({ voiceOutputEnabled }),
      setPreferredVoice: (preferredVoice) => set({ preferredVoice }),
    }),
    {
      name: 'agora-settings',
    }
  )
);
