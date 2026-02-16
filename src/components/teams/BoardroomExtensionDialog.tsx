// ─── Boardroom Session Extension Dialog ──────────────────────────────────────
// Allows extending a session that's approaching its max turns

import { useState, useCallback } from 'react';
import { useBoardroom } from '../../hooks/useBoardroom';
import type { BoardroomSession } from '../../types/boardroom';

interface BoardroomExtensionDialogProps {
  session: BoardroomSession;
  onClose: () => void;
  onExtend: () => void;
}

export function BoardroomExtensionDialog({
  session,
  onClose,
  onExtend,
}: BoardroomExtensionDialogProps) {
  const { updateSession } = useBoardroom();
  const [additionalTurns, setAdditionalTurns] = useState(10);
  const [extending, setExtending] = useState(false);

  const handleExtend = useCallback(async () => {
    setExtending(true);
    try {
      const newMaxTurns = session.max_turns + additionalTurns;
      await updateSession(session.id, { max_turns: newMaxTurns });

      // Track extension count in metadata
      const metadata = session.metadata || {};
      const extensionCount = (metadata.extension_count || 0) + 1;
      await updateSession(session.id, {
        metadata: { ...metadata, extension_count: extensionCount },
      });

      onExtend();
      onClose();
    } catch (err) {
      console.error('[ExtensionDialog] Error extending session:', err);
    } finally {
      setExtending(false);
    }
  }, [session, additionalTurns, updateSession, onExtend, onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
            <span className="text-xl">⏱️</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              Extend Session?
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              This session is approaching its turn limit. Would you like to add more turns to continue the discussion?
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-zinc-300 mb-2">
            Additional turns
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setAdditionalTurns(5)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                additionalTurns === 5
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              +5
            </button>
            <button
              onClick={() => setAdditionalTurns(10)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                additionalTurns === 10
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              +10
            </button>
            <button
              onClick={() => setAdditionalTurns(20)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                additionalTurns === 20
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              +20
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            New max: {session.max_turns} → <strong className="text-zinc-300">{session.max_turns + additionalTurns}</strong> turns
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={extending}
            className="flex-1 px-4 py-2 border border-zinc-700 rounded text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            Not Now
          </button>
          <button
            onClick={handleExtend}
            disabled={extending}
            className="flex-1 px-4 py-2 bg-amber-500 text-black rounded text-sm font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {extending ? 'Extending...' : 'Extend Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
