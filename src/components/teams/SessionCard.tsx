import { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '../../stores/agents';
import { getSessionPreset, type BoardroomSession, type BoardroomSessionMetadata } from '../../types/boardroom';

interface SessionCardProps {
  session: BoardroomSession;
  isSelected: boolean;
  onClick: () => void;
  onClone?: (sessionId: string) => void;
  onReschedule?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  onRestart?: (sessionId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  proposed: 'text-violet-400 bg-violet-500/10 animate-pulse',
  scheduled: 'text-blue-400 bg-blue-500/10',
  preparing: 'text-amber-400 bg-amber-500/10',
  open: 'text-zinc-400 bg-zinc-700/50',
  active: 'text-green-400 bg-green-500/10',
  closed: 'text-zinc-500 bg-zinc-800',
  declined: 'text-zinc-500 bg-zinc-800/50 opacity-60',
};

export function SessionCard({ session, isSelected, onClick, onClone, onReschedule, onDelete, onRestart }: SessionCardProps) {
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const preset = getSessionPreset(session.session_type);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const participantEmojis = session.participant_agent_ids
    .slice(0, 5)
    .map((id) => agentProfiles[id]?.emoji || '?');

  const dateStr = session.started_at
    ? new Date(session.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const metadata = session.metadata as BoardroomSessionMetadata;
  const routingMode = metadata?.routing_mode || 'smart';
  const autoStart = metadata?.auto_start !== false;
  const hasResolution = !!metadata?.resolution_package;
  const resolutionMode = metadata?.resolution_mode;
  
  // Show scheduled time for scheduled sessions
  const scheduledTimeStr = session.status === 'scheduled' && session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <button
      onClick={onClick}
      className={`
        group w-full text-left p-3 rounded-lg border transition-all
        ${isSelected
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-800/30'
        }
      `}
    >
      {/* Top row: type icon + title + status + menu */}
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0">{preset.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-medium text-zinc-200 truncate flex-1">{session.title}</h4>
            {/* Context menu */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((v) => !v);
                }}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded transition-all"
                title="Session actions"
              >
                &#x22EE;
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 w-40 py-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl">
                  {session.status !== 'active' && onReschedule && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onReschedule(session.id);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                    >
                      <span>&#x1F4C5;</span> Reschedule
                    </button>
                  )}
                  {onClone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onClone(session.id);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                    >
                      <span>&#x1F501;</span> Clone Session
                    </button>
                  )}
                  {session.status !== 'active' && session.turn_count > 0 && onRestart && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onRestart(session.id);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                    >
                      <span>&#x1F504;</span> Restart
                    </button>
                  )}
                  {session.status !== 'active' && onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDelete(session.id);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <span>&#x1F5D1;</span> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[session.status] || STATUS_COLORS.open}`}>
              {session.status === 'active' ? '● LIVE' : session.status === 'preparing' ? '◌ preparing' : session.status === 'proposed' ? '◈ proposed' : session.status}
            </span>
            {session.created_by !== 'user' && (() => {
              const creatorAgent = agentProfiles[session.created_by];
              return (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-violet-300 bg-violet-500/15 border border-violet-500/20">
                  {creatorAgent?.emoji || '🤖'} proposed
                </span>
              );
            })()}
            {scheduledTimeStr && autoStart && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-blue-400 bg-blue-500/10">
                ⏰ {scheduledTimeStr}
              </span>
            )}
            {routingMode === 'smart' && session.status !== 'closed' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-purple-400 bg-purple-500/10">
                🧠 smart
              </span>
            )}
            {hasResolution && session.status === 'closed' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10">
                📦 actions
              </span>
            )}
            {resolutionMode === 'auto' && session.status !== 'closed' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-cyan-400 bg-cyan-500/10">
                ⚡ auto
              </span>
            )}
            <span className="text-[10px] text-zinc-600">{dateStr}</span>
          </div>
        </div>
      </div>

      {/* Bottom row: participants + turn count */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center -space-x-1">
          {participantEmojis.map((emoji, i) => (
            <span key={i} className="text-xs">{emoji}</span>
          ))}
          {session.participant_agent_ids.length > 5 && (
            <span className="text-[10px] text-zinc-500 ml-1">+{session.participant_agent_ids.length - 5}</span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600">
          {session.turn_count}/{session.max_turns} turns
        </span>
      </div>
    </button>
  );
}
