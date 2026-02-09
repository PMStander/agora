import { useEffect, useState } from 'react';
import { useSettingsStore, type Theme } from '../../stores/settings';
import { useTheme } from '../../hooks/useTheme';
import { UpdateChecker } from './UpdateChecker';
import { PayPalSetup } from '../payments/PayPalSetup';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

export function GeneralSettings() {
  const settings = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const [autoStartStatus, setAutoStartStatus] = useState<boolean | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<boolean | null>(null);

  // Check autostart status on mount
  useEffect(() => {
    isEnabled().then(setAutoStartStatus).catch(() => setAutoStartStatus(false));
    isPermissionGranted().then(setNotificationPermission).catch(() => setNotificationPermission(false));
  }, []);

  const handleAutoStartToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
      setAutoStartStatus(enabled);
      settings.setAutoStartEnabled(enabled);
    } catch (err) {
      console.error('Failed to toggle autostart:', err);
      // Still update UI state even if Tauri API fails
      setAutoStartStatus(false);
    }
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    try {
      if (enabled && !notificationPermission) {
        const permission = await requestPermission();
        setNotificationPermission(permission === 'granted');
        if (permission !== 'granted') return;
      }
      settings.setNotificationsEnabled(enabled);
    } catch (err) {
      console.error('Failed to toggle notifications:', err);
      setNotificationPermission(false);
    }
  };

  const testNotification = async () => {
    try {
      if (!notificationPermission) {
        const permission = await requestPermission();
        setNotificationPermission(permission === 'granted');
        if (permission !== 'granted') return;
      }
      sendNotification({
        title: 'Agora',
        body: 'Notifications are working! 🏛️',
      });
    } catch (err) {
      console.error('Failed to send test notification:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">🎨</span> Appearance
        </h3>
        <div className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Theme</p>
              <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* Accent Color */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Accent Color</p>
              <p className="text-sm text-muted-foreground">Highlight color for UI elements</p>
            </div>
            <div className="flex gap-2">
              {(['gold', 'cyan', 'purple', 'green'] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => settings.setAccentColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    settings.accentColor === color ? 'scale-110 border-white' : 'border-transparent'
                  }`}
                  style={{
                    backgroundColor:
                      color === 'gold' ? '#D4AF37' :
                      color === 'cyan' ? '#00CED1' :
                      color === 'purple' ? '#9B59B6' :
                      '#27AE60',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Compact Mode</p>
              <p className="text-sm text-muted-foreground">Reduce spacing and padding</p>
            </div>
            <Toggle
              enabled={settings.compactMode}
              onToggle={settings.setCompactMode}
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">🔔</span> Notifications
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Enable Notifications</p>
              <p className="text-sm text-muted-foreground">
                {notificationPermission === false
                  ? 'Permission denied - enable in System Preferences'
                  : 'Show desktop notifications'}
              </p>
            </div>
            <Toggle
              enabled={settings.notificationsEnabled}
              onToggle={handleNotificationToggle}
              disabled={notificationPermission === false}
            />
          </div>

          {settings.notificationsEnabled && (
            <>
              <div className="flex items-center justify-between pl-4">
                <div>
                  <p className="font-medium text-foreground">Agent Mission Complete</p>
                  <p className="text-sm text-muted-foreground">Notify when sub-agents finish</p>
                </div>
                <Toggle
                  enabled={settings.notifyOnAgentComplete}
                  onToggle={settings.setNotifyOnAgentComplete}
                />
              </div>

              <div className="flex items-center justify-between pl-4">
                <div>
                  <p className="font-medium text-foreground">Mentions</p>
                  <p className="text-sm text-muted-foreground">Notify when an agent mentions you</p>
                </div>
                <Toggle
                  enabled={settings.notifyOnMention}
                  onToggle={settings.setNotifyOnMention}
                />
              </div>

              <div className="flex items-center justify-between pl-4">
                <div>
                  <p className="font-medium text-foreground">Sound</p>
                  <p className="text-sm text-muted-foreground">Play notification sounds</p>
                </div>
                <Toggle
                  enabled={settings.soundEnabled}
                  onToggle={settings.setSoundEnabled}
                />
              </div>

              <button
                onClick={testNotification}
                className="ml-4 px-4 py-2 bg-accent text-background rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
              >
                Test Notification
              </button>
            </>
          )}
        </div>
      </section>

      {/* Behavior */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">⚙️</span> Behavior
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Start on Login</p>
              <p className="text-sm text-muted-foreground">Launch Agora when you log in</p>
            </div>
            <Toggle
              enabled={autoStartStatus ?? settings.autoStartEnabled}
              onToggle={handleAutoStartToggle}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Minimize to Tray</p>
              <p className="text-sm text-muted-foreground">Keep running in system tray when closed</p>
            </div>
            <Toggle
              enabled={settings.minimizeToTray}
              onToggle={settings.setMinimizeToTray}
            />
          </div>
        </div>
      </section>

      {/* Payments */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">💳</span> Payments (PayPal)
        </h3>
        <PayPalSetup />
      </section>

      {/* Voice */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">🎙️</span> Voice
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Voice Input</p>
              <p className="text-sm text-muted-foreground">Use microphone for input (coming soon)</p>
            </div>
            <Toggle
              enabled={settings.voiceInputEnabled}
              onToggle={settings.setVoiceInputEnabled}
              disabled
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Voice Output</p>
              <p className="text-sm text-muted-foreground">Read agent responses aloud (coming soon)</p>
            </div>
            <Toggle
              enabled={settings.voiceOutputEnabled}
              onToggle={settings.setVoiceOutputEnabled}
              disabled
            />
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">⌨️</span> Keyboard Shortcuts
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Toggle Agora (global)</span>
            <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono">⌘⇧A</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Quick switch agents</span>
            <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono">⌘1-9</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Previous/Next agent</span>
            <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono">⌘[ / ⌘]</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">New message</span>
            <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono">⌘N</kbd>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Settings</span>
            <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono">⌘,</kbd>
          </div>
        </div>
      </section>

      {/* Updates */}
      <section>
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <span className="text-xl">🔄</span> Updates
        </h3>
        <UpdateChecker />
      </section>

      {/* About */}
      <section className="text-center pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Agora v0.1.0 • Built with Tauri & React
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          "Where philosophers gather and ideas converge" 🏛️
        </p>
      </section>
    </div>
  );
}

// Toggle component
function Toggle({
  enabled,
  onToggle,
  disabled = false,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onToggle(!enabled)}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-accent' : 'bg-muted'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
