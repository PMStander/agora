// ─── Boardroom Session Settings Panel ────────────────────────────────────────
// Configuration for routing mode, auto-start, and WhatsApp notifications

import { useState, useCallback } from 'react';
import { useBoardroom } from '../../hooks/useBoardroom';
import type { BoardroomSession, BoardroomSessionMetadata, RoutingMode } from '../../types/boardroom';

interface BoardroomSessionSettingsProps {
  session: BoardroomSession;
}

export function BoardroomSessionSettings({ session }: BoardroomSessionSettingsProps) {
  const { updateSessionMetadata } = useBoardroom();
  const metadata = (session.metadata || {}) as BoardroomSessionMetadata;

  const [routingMode, setRoutingMode] = useState<RoutingMode>(metadata.routing_mode || 'smart');
  const [autoStart, setAutoStart] = useState<boolean>(metadata.auto_start ?? true);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState<boolean>(metadata.notify_whatsapp ?? true);

  const handleRoutingModeChange = useCallback(
    async (mode: RoutingMode) => {
      setRoutingMode(mode);
      await updateSessionMetadata(session.id, { routing_mode: mode });
    },
    [session.id, updateSessionMetadata]
  );

  const handleAutoStartToggle = useCallback(
    async () => {
      const newValue = !autoStart;
      setAutoStart(newValue);
      await updateSessionMetadata(session.id, { auto_start: newValue });
    },
    [session.id, autoStart, updateSessionMetadata]
  );

  const handleNotifyWhatsAppToggle = useCallback(
    async () => {
      const newValue = !notifyWhatsApp;
      setNotifyWhatsApp(newValue);
      await updateSessionMetadata(session.id, { notify_whatsapp: newValue });
    },
    [session.id, notifyWhatsApp, updateSessionMetadata]
  );

  return (
    <div className="space-y-3 pt-3 border-t border-zinc-800">
      <h3 className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">
        Session Settings
      </h3>

      {/* Routing Mode */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-1.5">
          Routing Mode
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleRoutingModeChange('smart')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              routingMode === 'smart'
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            Smart
          </button>
          <button
            onClick={() => handleRoutingModeChange('round-robin')}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
              routingMode === 'round-robin'
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            Round-Robin
          </button>
        </div>
        <p className="mt-1 text-[10px] text-zinc-500">
          {routingMode === 'smart'
            ? 'Intelligent agent selection based on relevance and participation balance'
            : 'Fixed rotation through all participants'}
        </p>
      </div>

      {/* Auto-Start (for scheduled sessions) */}
      {session.scheduled_at && (
        <div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={handleAutoStartToggle}
              className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
            />
            <span>Auto-start at scheduled time</span>
          </label>
          <p className="mt-1 ml-6 text-[10px] text-zinc-500">
            {autoStart
              ? `Will start automatically at ${new Date(session.scheduled_at).toLocaleString()}`
              : 'Requires manual start via "Start Conversation" button'}
          </p>
        </div>
      )}

      {/* WhatsApp Notifications */}
      <div>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={notifyWhatsApp}
            onChange={handleNotifyWhatsAppToggle}
            className="rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
          />
          <span>Send WhatsApp notifications</span>
        </label>
        <p className="mt-1 ml-6 text-[10px] text-zinc-500">
          Sends notifications when the session starts and ends (with summary)
        </p>
      </div>

      {/* Current Phase Indicator */}
      {metadata.current_phase && session.status === 'active' && (
        <div className="pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">
              Current Phase
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              metadata.current_phase === 'opening'
                ? 'bg-green-500/10 text-green-400'
                : metadata.current_phase === 'discussion'
                ? 'bg-blue-500/10 text-blue-400'
                : 'bg-orange-500/10 text-orange-400'
            }`}>
              {metadata.current_phase.charAt(0).toUpperCase() + metadata.current_phase.slice(1)}
            </span>
          </div>
        </div>
      )}

      {/* Last Routing Decision */}
      {metadata.last_routing_decision && routingMode === 'smart' && (
        <div className="pt-2 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-500">
            <div className="font-medium mb-1">Last Routing Decision:</div>
            <div className="italic text-zinc-400">{metadata.last_routing_decision.reasoning}</div>
          </div>
        </div>
      )}
    </div>
  );
}
