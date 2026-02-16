import { useState, useEffect, useCallback } from 'react';
import { openclawClient, type ConnectionStatus } from '../../lib/openclawClient';

export function GatewayHealthBanner() {
  const [status, setStatus] = useState<ConnectionStatus>(openclawClient.status);
  const [attempt, setAttempt] = useState(openclawClient.reconnectAttempt);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubStatus = openclawClient.onStatusChange((s) => {
      setStatus(s);
      setAttempt(openclawClient.reconnectAttempt);
      // Auto-show when disconnected again after dismiss
      if (s !== 'connected') setDismissed(false);
    });
    return unsubStatus;
  }, []);

  const handleRetry = useCallback(() => {
    openclawClient.resetReconnectAttempts();
    openclawClient.connect().catch(() => {});
  }, []);

  // Don't show when connected or dismissed
  if (status === 'connected' || dismissed) return null;

  const isConnecting = status === 'connecting';
  const showAttempt = attempt > 0 && !isConnecting;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
      <div className="flex items-center gap-2">
        {isConnecting ? (
          <svg className="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        )}
        <span>
          {isConnecting
            ? 'Connecting to OpenClaw Gateway...'
            : 'Gateway offline — agents unavailable.'}
          {showAttempt && (
            <span className="text-amber-500/70 ml-1">(retry #{attempt})</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!isConnecting && (
          <button
            onClick={handleRetry}
            className="text-amber-300 hover:text-amber-200 hover:underline"
          >
            Retry now
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500/50 hover:text-amber-400 ml-1"
          title="Dismiss"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
