// ─── Boardroom Session Detail Panel ──────────────────────────────────────────
// Enhanced detail view with inline editing and prep documents

import { useState, useCallback } from 'react';
import { useAgentStore } from '../../stores/agents';
import { useBoardroomStore } from '../../stores/boardroom';
import { useBoardroom } from '../../hooks/useBoardroom';
import { supabase } from '../../lib/supabase';
import {
  getSessionPreset,
  type BoardroomSession,
  type BoardroomSessionMetadata,
  type BoardroomSessionStatus,
} from '../../types/boardroom';
import { BoardroomSessionSettings } from './BoardroomSessionSettings';

interface BoardroomSessionDetailProps {
  session: BoardroomSession;
}

export function BoardroomSessionDetail({ session }: BoardroomSessionDetailProps) {
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const updateSession = useBoardroomStore((s) => s.updateSession);
  const { rescheduleSession, cloneSession, deleteSession, restartSession, updateSession: updateSessionDb } = useBoardroom();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [isEditingAgenda, setIsEditingAgenda] = useState(false);
  const [editedTitle, setEditedTitle] = useState(session.title);
  const [editedTopic, setEditedTopic] = useState(session.topic);
  const [editedAgenda, setEditedAgenda] = useState(
    (session.metadata?.agenda || []).join('\n')
  );

  // Reschedule state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const preset = getSessionPreset(session.session_type);
  const metadata = session.metadata as BoardroomSessionMetadata | undefined;
  const agenda = metadata?.agenda || [];
  const context = metadata?.context || '';
  const prepDocs = metadata?.prep_documents || [];

  // ─── Update helpers ──────────────────────────────────────────────────────

  const updateSessionField = useCallback(
    async (field: string, value: any) => {
      const updates: any = {
        [field]: value,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('boardroom_sessions')
        .update(updates)
        .eq('id', session.id);

      if (!error) {
        updateSession(session.id, updates);
      } else {
        console.error(`[SessionDetail] Error updating ${field}:`, error);
      }
    },
    [session.id, updateSession]
  );

  const updateMetadataField = useCallback(
    async (field: keyof BoardroomSessionMetadata, value: any) => {
      const merged = { ...metadata, [field]: value };
      const { error } = await supabase
        .from('boardroom_sessions')
        .update({
          metadata: merged,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (!error) {
        updateSession(session.id, { metadata: merged });
      } else {
        console.error(`[SessionDetail] Error updating metadata.${field}:`, error);
      }
    },
    [session.id, metadata, updateSession]
  );

  // ─── Edit handlers ───────────────────────────────────────────────────────

  const handleSaveTitle = useCallback(async () => {
    if (editedTitle.trim() && editedTitle !== session.title) {
      await updateSessionField('title', editedTitle.trim());
    }
    setIsEditingTitle(false);
  }, [editedTitle, session.title, updateSessionField]);

  const handleSaveTopic = useCallback(async () => {
    if (editedTopic !== session.topic) {
      await updateSessionField('topic', editedTopic);
    }
    setIsEditingTopic(false);
  }, [editedTopic, session.topic, updateSessionField]);

  const handleSaveAgenda = useCallback(async () => {
    const agendaItems = editedAgenda
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    await updateMetadataField('agenda', agendaItems);
    setIsEditingAgenda(false);
  }, [editedAgenda, updateMetadataField]);

  const handleStatusChange = useCallback(
    async (newStatus: BoardroomSessionStatus) => {
      const updates: any = { status: newStatus };
      if (newStatus === 'active' && !session.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (newStatus === 'closed' && !session.ended_at) {
        updates.ended_at = new Date().toISOString();
      }
      await updateSessionField('status', newStatus);
      if (updates.started_at || updates.ended_at) {
        await supabase
          .from('boardroom_sessions')
          .update(updates)
          .eq('id', session.id);
        updateSession(session.id, updates);
      }
    },
    [session, updateSessionField, updateSession]
  );

  const handleRemoveParticipant = useCallback(
    async (agentId: string) => {
      const updated = session.participant_agent_ids.filter((id) => id !== agentId);
      if (updated.length > 0) {
        await updateSessionField('participant_agent_ids', updated);
      }
    },
    [session.participant_agent_ids, updateSessionField]
  );

  const handleOpenPrepDoc = useCallback((path: string) => {
    // For now, just log. Could open in external viewer or file preview.
    console.log('[SessionDetail] Open prep doc:', path);
    // Future: integrate with file viewer or external app
  }, []);

  const handleReschedule = useCallback(async () => {
    if (!rescheduleDate) {
      setRescheduleError('Pick a date and time');
      return;
    }
    const target = new Date(rescheduleDate);
    if (target <= new Date()) {
      setRescheduleError('Must be in the future');
      return;
    }
    setRescheduleError('');
    const result = await rescheduleSession(session.id, target.toISOString());
    if (result.success) {
      setIsRescheduling(false);
      setRescheduleDate('');
    } else {
      setRescheduleError(result.error || 'Failed to reschedule');
    }
  }, [rescheduleDate, rescheduleSession, session.id]);

  const handleClone = useCallback(async () => {
    setIsCloning(true);
    await cloneSession(session.id);
    setIsCloning(false);
  }, [cloneSession, session.id]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete "${session.title}" and all its messages? This cannot be undone.`)) return;
    setIsDeleting(true);
    await deleteSession(session.id);
    setIsDeleting(false);
  }, [deleteSession, session.id, session.title]);

  const handleRestart = useCallback(async () => {
    if (!window.confirm(`Restart "${session.title}"? All messages will be deleted but the session setup will be preserved.`)) return;
    setIsRestarting(true);
    await restartSession(session.id);
    setIsRestarting(false);
  }, [restartSession, session.id, session.title]);

  // ─── Proposal actions ────────────────────────────────────────────────────

  const handleApproveProposal = useCallback(async () => {
    await updateSessionDb(session.id, { status: 'open' });
  }, [updateSessionDb, session.id]);

  const handleDeclineProposal = useCallback(async () => {
    await updateSessionDb(session.id, { status: 'declined' as any });
  }, [updateSessionDb, session.id]);

  const proposalCreator = session.created_by !== 'user' ? agentProfiles[session.created_by] : null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto">
      {/* Proposal banner (when status is 'proposed') */}
      {session.status === 'proposed' && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-violet-500/5 to-amber-500/10 overflow-hidden">
          <div className="px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">{proposalCreator?.emoji || '🤖'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-amber-200">
                  Session Proposed by {proposalCreator?.name || session.created_by}
                </div>
                {metadata?.proposal_reason && (
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    {metadata.proposal_reason}
                  </p>
                )}
                {metadata?.proposal_urgency && (
                  <span className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    metadata.proposal_urgency === 'critical' ? 'bg-red-500/20 text-red-400' :
                    metadata.proposal_urgency === 'high' ? 'bg-orange-500/20 text-orange-400' :
                    metadata.proposal_urgency === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-zinc-600/20 text-zinc-400'
                  }`}>
                    {metadata.proposal_urgency} urgency
                  </span>
                )}
                {metadata?.proposed_by_context && (
                  <p className="text-[10px] text-zinc-500 mt-1 italic">
                    Context: {metadata.proposed_by_context}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 ml-8">
              <button
                onClick={handleApproveProposal}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 rounded-md transition-colors"
              >
                Approve &amp; Open
              </button>
              <button
                onClick={handleDeclineProposal}
                className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">{preset.icon}</span>
          <div className="flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') {
                    setEditedTitle(session.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
                className="w-full px-2 py-0.5 text-sm font-semibold bg-zinc-800 border border-amber-500 rounded text-zinc-100 focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-sm font-semibold text-zinc-100 hover:text-amber-400 transition-colors text-left"
              >
                {session.title}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Topic */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-1">
            Topic
          </label>
          {isEditingTopic ? (
            <textarea
              value={editedTopic}
              onChange={(e) => setEditedTopic(e.target.value)}
              onBlur={handleSaveTopic}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditedTopic(session.topic);
                  setIsEditingTopic(false);
                }
              }}
              autoFocus
              rows={2}
              className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-amber-500 rounded text-zinc-300 focus:outline-none resize-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingTopic(true)}
              className="w-full text-left text-xs text-zinc-400 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800/50"
            >
              {session.topic || <em className="text-zinc-600">Click to add topic...</em>}
            </button>
          )}
        </div>

        {/* Status & Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-1">
              Status
            </label>
            <select
              value={session.status}
              onChange={(e) => handleStatusChange(e.target.value as BoardroomSessionStatus)}
              className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value="proposed">Proposed</option>
              <option value="scheduled">Scheduled</option>
              <option value="preparing">Preparing</option>
              <option value="open">Open</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-1">
              Type
            </label>
            <div className="px-2 py-1.5 text-xs bg-zinc-800/50 border border-zinc-700/50 rounded text-zinc-400">
              {preset.label}
            </div>
          </div>
        </div>

        {/* Scheduled time (inline editable for non-active sessions) */}
        {session.scheduled_at && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-1">
              Scheduled
            </label>
            <div className="text-xs text-zinc-400 px-2">
              {new Date(session.scheduled_at).toLocaleString()}
            </div>
          </div>
        )}

        {/* Agenda */}
        {(agenda.length > 0 || isEditingAgenda) && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">
                Agenda
              </label>
              {!isEditingAgenda && (
                <button
                  onClick={() => {
                    setEditedAgenda(agenda.join('\n'));
                    setIsEditingAgenda(true);
                  }}
                  className="text-[10px] text-amber-500 hover:text-amber-400"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingAgenda ? (
              <div className="space-y-1">
                <textarea
                  value={editedAgenda}
                  onChange={(e) => setEditedAgenda(e.target.value)}
                  placeholder="One item per line..."
                  rows={6}
                  className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-amber-500 rounded text-zinc-300 focus:outline-none resize-none font-mono"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleSaveAgenda}
                    className="px-2 py-1 text-[10px] bg-amber-500 text-black rounded hover:bg-amber-400"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditedAgenda(agenda.join('\n'));
                      setIsEditingAgenda(false);
                    }}
                    className="px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <ol className="space-y-2 pl-6 list-decimal marker:text-amber-500 marker:font-semibold">
                {agenda.map((item, i) => (
                  <li key={i} className="text-xs text-zinc-300 leading-relaxed pl-1">
                    {item}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Context */}
        {context && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-1">
              Context
            </label>
            <div className="text-xs text-zinc-400 px-2 py-1.5 bg-zinc-800/30 rounded border border-zinc-700/50 whitespace-pre-wrap leading-relaxed">
              {context}
            </div>
          </div>
        )}

        {/* Participants */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-2">
            Participants ({session.participant_agent_ids.length})
          </label>
          <div className="space-y-1">
            {session.participant_agent_ids.map((agentId) => {
              const agent = agentProfiles[agentId];
              return (
                <div
                  key={agentId}
                  className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors group"
                >
                  <span className="text-base">{agent?.emoji || '?'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-300">
                      {agent?.name || agentId}
                    </div>
                    {agent?.role && (
                      <div className="text-[10px] text-zinc-500 truncate">
                        {agent.role}
                      </div>
                    )}
                  </div>
                  {session.participant_agent_ids.length > 1 && (
                    <button
                      onClick={() => handleRemoveParticipant(agentId)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-300 transition-opacity"
                      title="Remove participant"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Prep Documents */}
        {prepDocs.length > 0 && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500 mb-2">
              Prep Documents ({prepDocs.length})
            </label>
            <div className="space-y-1">
              {prepDocs.map((doc, i) => {
                const agent = agentProfiles[doc.agent_id];
                const statusColor =
                  doc.status === 'done'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : doc.status === 'failed'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

                return (
                  <button
                    key={i}
                    onClick={() => handleOpenPrepDoc(doc.path)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors group text-left"
                  >
                    <span className="text-base shrink-0">{agent?.emoji || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-300 truncate">
                        {doc.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate font-mono">
                        {doc.path}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 text-[9px] uppercase font-medium rounded ${statusColor}`}
                    >
                      {doc.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-zinc-600">Turns:</span>{' '}
              <span className="text-zinc-400">
                {session.turn_count}/{session.max_turns}
              </span>
            </div>
            <div>
              <span className="text-zinc-600">Created:</span>{' '}
              <span className="text-zinc-400">
                {new Date(session.created_at).toLocaleDateString()}
              </span>
            </div>
            {session.started_at && (
              <div>
                <span className="text-zinc-600">Started:</span>{' '}
                <span className="text-zinc-400">
                  {new Date(session.started_at).toLocaleString()}
                </span>
              </div>
            )}
            {session.ended_at && (
              <div>
                <span className="text-zinc-600">Ended:</span>{' '}
                <span className="text-zinc-400">
                  {new Date(session.ended_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Session Settings */}
        {session.status !== 'closed' && (
          <BoardroomSessionSettings session={session} />
        )}

        {/* ─── Actions ─────────────────────────────────────────────── */}
        <div className="pt-3 border-t border-zinc-800 space-y-3">
          <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500">
            Actions
          </label>

          <div className="flex gap-2">
            {/* Reschedule — available for scheduled/open/preparing/closed, NOT active */}
            {session.status !== 'active' && (
              <button
                onClick={() => {
                  const current = session.scheduled_at
                    ? new Date(session.scheduled_at).toISOString().slice(0, 16)
                    : '';
                  setRescheduleDate(current);
                  setRescheduleError('');
                  setIsRescheduling((v) => !v);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-500/20 transition-colors"
              >
                <span className="text-sm">&#x1F4C5;</span>
                Reschedule
              </button>
            )}

            {/* Clone — always available */}
            <button
              onClick={handleClone}
              disabled={isCloning}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              <span className="text-sm">&#x1F501;</span>
              {isCloning ? 'Cloning...' : 'Clone Session'}
            </button>

            {/* Restart — available for closed/open/scheduled, NOT active */}
            {session.status !== 'active' && session.turn_count > 0 && (
              <button
                onClick={handleRestart}
                disabled={isRestarting}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-md hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              >
                <span className="text-sm">&#x1F504;</span>
                {isRestarting ? 'Restarting...' : 'Restart'}
              </button>
            )}
          </div>

          {/* Delete — separate danger zone */}
          {session.status !== 'active' && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Session'}
            </button>
          )}

          {/* Reschedule inline form */}
          {isRescheduling && (
            <div className="space-y-2 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
              <label className="block text-[10px] uppercase tracking-wider font-medium text-zinc-500">
                New date & time
              </label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => {
                  setRescheduleDate(e.target.value);
                  setRescheduleError('');
                }}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:border-amber-500"
              />
              {rescheduleError && (
                <p className="text-[10px] text-red-400">{rescheduleError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleReschedule}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-black rounded hover:bg-amber-400 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setIsRescheduling(false);
                    setRescheduleError('');
                  }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                {session.scheduled_at && (
                  <button
                    onClick={async () => {
                      const result = await rescheduleSession(session.id, null);
                      if (result.success) {
                        setIsRescheduling(false);
                        setRescheduleDate('');
                      }
                    }}
                    className="ml-auto px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                    title="Remove schedule and start immediately"
                  >
                    Start Now
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cloned-from link */}
          {metadata?.cloned_from_session_id && (
            <p className="text-[10px] text-zinc-600">
              Cloned from a previous session
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
