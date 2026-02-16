// ─── Resolution Inbox ─────────────────────────────────────────────────────────
// Aggregated view of ALL pending resolution items across ALL closed sessions.
// Central "agent action queue" for reviewing what agents want to do.

import { useState, useMemo, useCallback } from 'react';
import { useBoardroomStore } from '../../stores/boardroom';
import { useAgentStore } from '../../stores/agents';
import { useBoardroomResolution } from '../../hooks/useBoardroomResolution';
import { getResolutionItemIcon, getResolutionItemTypeLabel } from '../../lib/boardroomResolution';
import { getSessionPreset } from '../../types/boardroom';
import type {
  BoardroomSession,
  BoardroomSessionMetadata,
  ResolutionPackageItem,
  ResolutionMission,
  ResolutionFollowUpMeeting,
  ResolutionDocument,
} from '../../types/boardroom';
import { cn } from '../../lib/utils';

// ─── Pending Resolution Count Hook (for nav badge) ────────────────────────────

export function usePendingResolutionCount(): number {
  const sessions = useBoardroomStore((s) => s.sessions);
  return useMemo(() => {
    let count = 0;
    for (const session of sessions) {
      const metadata = session.metadata as BoardroomSessionMetadata;
      const pkg = metadata?.resolution_package;
      if (!pkg) continue;
      for (const item of pkg.items) {
        if (item.status === 'pending') count++;
      }
    }
    return count;
  }, [sessions]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionGroup {
  session: BoardroomSession;
  items: ResolutionPackageItem[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ResolutionInbox() {
  const sessions = useBoardroomStore((s) => s.sessions);
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const {
    approveResolutionItem,
    rejectResolutionItem,
    approveAllItems,
    executeResolutionPackage,
  } = useBoardroomResolution();

  const [executingSessionIds, setExecutingSessionIds] = useState<Set<string>>(new Set());
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());

  // ── Aggregate all actionable items across sessions ──────────────────────
  const { sessionGroups, totalPending, totalApproved, totalCreated } = useMemo(() => {
    const groups: SessionGroup[] = [];
    let pending = 0;
    let approved = 0;
    let created = 0;

    for (const session of sessions) {
      const metadata = session.metadata as BoardroomSessionMetadata;
      const pkg = metadata?.resolution_package;
      if (!pkg || pkg.items.length === 0) continue;

      // Only include items that are pending or approved (not yet executed)
      const actionableItems = pkg.items.filter(
        (item) => item.status === 'pending' || item.status === 'approved'
      );

      if (actionableItems.length === 0) continue;

      groups.push({ session, items: actionableItems });

      for (const item of actionableItems) {
        if (item.status === 'pending') pending++;
        if (item.status === 'approved') approved++;
      }

      // Count created items for the stats
      for (const item of pkg.items) {
        if (item.status === 'created') created++;
      }
    }

    // Sort by most recent session first
    groups.sort((a, b) => {
      const aDate = a.session.ended_at || a.session.updated_at || a.session.created_at;
      const bDate = b.session.ended_at || b.session.updated_at || b.session.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return { sessionGroups: groups, totalPending: pending, totalApproved: approved, totalCreated: created };
  }, [sessions]);

  // ── Batch: Approve all pending across all sessions ──────────────────────
  const handleApproveAll = useCallback(async () => {
    for (const group of sessionGroups) {
      const hasPending = group.items.some((i) => i.status === 'pending');
      if (hasPending) {
        await approveAllItems(group.session.id);
      }
    }
  }, [sessionGroups, approveAllItems]);

  // ── Batch: Execute all approved across all sessions ─────────────────────
  const handleExecuteAll = useCallback(async () => {
    const sessionsWithApproved = sessionGroups.filter((g) =>
      g.items.some((i) => i.status === 'approved')
    );

    const newExecuting = new Set(executingSessionIds);
    for (const group of sessionsWithApproved) {
      newExecuting.add(group.session.id);
    }
    setExecutingSessionIds(newExecuting);

    try {
      for (const group of sessionsWithApproved) {
        await executeResolutionPackage(group.session.id);
      }
    } finally {
      setExecutingSessionIds(new Set());
    }
  }, [sessionGroups, executingSessionIds, executeResolutionPackage]);

  // ── Per-session execute ─────────────────────────────────────────────────
  const handleExecuteSession = useCallback(
    async (sessionId: string) => {
      setExecutingSessionIds((prev) => new Set(prev).add(sessionId));
      try {
        await executeResolutionPackage(sessionId);
      } finally {
        setExecutingSessionIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    },
    [executeResolutionPackage]
  );

  const toggleSessionCollapsed = useCallback((sessionId: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const isExecutingAny = executingSessionIds.size > 0;

  // ── Empty state ─────────────────────────────────────────────────────────
  if (sessionGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="text-4xl mb-4">
          <span role="img" aria-label="check">&#x2705;</span>
        </div>
        <h3 className="text-lg font-semibold text-zinc-200 mb-2">All caught up!</h3>
        <p className="text-sm text-zinc-500 max-w-sm">
          No pending agent proposals. When boardroom sessions close, resolution items will appear here for your review.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Resolution Inbox</h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Review and approve agent proposals from boardroom sessions
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-zinc-400">{totalPending} pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-zinc-400">{totalApproved} approved</span>
          </div>
          {totalCreated > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-zinc-400">{totalCreated} created</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">
              {sessionGroups.length} session{sessionGroups.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Batch action buttons */}
      <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-3 flex-wrap">
        {totalPending > 0 && (
          <button
            onClick={handleApproveAll}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
          >
            Approve All ({totalPending})
          </button>
        )}
        {totalApproved > 0 && (
          <button
            onClick={handleExecuteAll}
            disabled={isExecutingAny}
            className={cn(
              'px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors',
              isExecutingAny && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isExecutingAny ? 'Executing...' : `Execute All Approved (${totalApproved})`}
          </button>
        )}
        {totalPending === 0 && totalApproved === 0 && (
          <span className="text-xs text-zinc-500">All items have been processed</span>
        )}
      </div>

      {/* Session groups */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {sessionGroups.map((group) => (
          <SessionResolutionGroup
            key={group.session.id}
            session={group.session}
            items={group.items}
            agentProfiles={agentProfiles}
            isCollapsed={collapsedSessions.has(group.session.id)}
            onToggleCollapsed={() => toggleSessionCollapsed(group.session.id)}
            isExecuting={executingSessionIds.has(group.session.id)}
            onApproveItem={approveResolutionItem}
            onRejectItem={rejectResolutionItem}
            onApproveAll={() => approveAllItems(group.session.id)}
            onExecute={() => handleExecuteSession(group.session.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Session Resolution Group ─────────────────────────────────────────────────

interface SessionResolutionGroupProps {
  session: BoardroomSession;
  items: ResolutionPackageItem[];
  agentProfiles: Record<string, any>;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  isExecuting: boolean;
  onApproveItem: (sessionId: string, itemId: string) => void;
  onRejectItem: (sessionId: string, itemId: string) => void;
  onApproveAll: () => void;
  onExecute: () => void;
}

function SessionResolutionGroup({
  session,
  items,
  agentProfiles,
  isCollapsed,
  onToggleCollapsed,
  isExecuting,
  onApproveItem,
  onRejectItem,
  onApproveAll,
  onExecute,
}: SessionResolutionGroupProps) {
  const preset = getSessionPreset(session.session_type);
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const approvedCount = items.filter((i) => i.status === 'approved').length;

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
      {/* Session header */}
      <button
        onClick={onToggleCollapsed}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <span className="text-lg">{preset.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-zinc-200 text-sm truncate">{session.title}</div>
          <div className="text-xs text-zinc-500 truncate">
            {preset.label}
            {session.ended_at && (
              <> &middot; Closed {formatRelativeTime(session.ended_at)}</>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              {pendingCount} pending
            </span>
          )}
          {approvedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              {approvedCount} approved
            </span>
          )}
          <span className="text-zinc-600 text-sm">{isCollapsed ? '▶' : '▼'}</span>
        </div>
      </button>

      {/* Items */}
      {!isCollapsed && (
        <div className="border-t border-zinc-800">
          {/* Per-session action bar */}
          {(pendingCount > 0 || approvedCount > 0) && (
            <div className="px-4 py-2 bg-zinc-800/30 flex items-center gap-2 border-b border-zinc-800/50">
              {pendingCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onApproveAll();
                  }}
                  className="px-3 py-1.5 bg-green-600/80 hover:bg-green-600 rounded text-xs font-medium transition-colors"
                >
                  Approve All ({pendingCount})
                </button>
              )}
              {approvedCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExecute();
                  }}
                  disabled={isExecuting}
                  className={cn(
                    'px-3 py-1.5 bg-amber-600/80 hover:bg-amber-600 rounded text-xs font-medium transition-colors',
                    isExecuting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isExecuting ? 'Executing...' : `Execute (${approvedCount})`}
                </button>
              )}
            </div>
          )}

          <div className="p-4 space-y-2">
            {items.map((item) => (
              <InboxResolutionItem
                key={`${session.id}-${item.id}`}
                item={item}
                sessionId={session.id}
                agentProfiles={agentProfiles}
                onApprove={onApproveItem}
                onReject={onRejectItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resolution Item ──────────────────────────────────────────────────────────

interface InboxResolutionItemProps {
  item: ResolutionPackageItem;
  sessionId: string;
  agentProfiles: Record<string, any>;
  onApprove: (sessionId: string, itemId: string) => void;
  onReject: (sessionId: string, itemId: string) => void;
}

function InboxResolutionItem({
  item,
  sessionId,
  agentProfiles,
  onApprove,
  onReject,
}: InboxResolutionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColor = {
    pending: 'border-amber-500/30 bg-amber-500/5',
    approved: 'border-green-500/30 bg-green-500/5',
    created: 'border-blue-500/30 bg-blue-500/5',
    rejected: 'border-red-500/30 bg-red-500/5',
  }[item.status];

  const statusBadge = {
    pending: (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
        Pending
      </span>
    ),
    approved: (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
        Approved
      </span>
    ),
    created: (
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
        Created
      </span>
    ),
    rejected: (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
        Rejected
      </span>
    ),
  }[item.status];

  const renderItemDetails = () => {
    switch (item.type) {
      case 'mission': {
        const mission = item.data as ResolutionMission;
        const agent = agentProfiles[mission.agent_id];
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getResolutionItemIcon(item.type)}</span>
              <span className="font-medium text-zinc-200 text-sm">{mission.title}</span>
              <span className="text-xs text-zinc-600">{getResolutionItemTypeLabel(item.type)}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{mission.description}</div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-zinc-500">
                Assigned: {agent ? `${agent.emoji} ${agent.name}` : mission.agent_id}
              </span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full',
                  mission.priority === 'urgent'
                    ? 'bg-red-500/20 text-red-400'
                    : mission.priority === 'high'
                      ? 'bg-orange-500/20 text-orange-400'
                      : mission.priority === 'medium'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-600/20 text-zinc-400'
                )}
              >
                {mission.priority}
              </span>
            </div>
          </div>
        );
      }

      case 'follow_up': {
        const meeting = item.data as ResolutionFollowUpMeeting;
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getResolutionItemIcon(item.type)}</span>
              <span className="font-medium text-zinc-200 text-sm">{meeting.title}</span>
              <span className="text-xs text-zinc-600">{getResolutionItemTypeLabel(item.type)}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{meeting.topic}</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
              <span>
                Participants:{' '}
                {meeting.participant_agent_ids
                  .map((id) => {
                    const p = agentProfiles[id];
                    return p ? p.emoji : '?';
                  })
                  .join(' ')}
              </span>
              {meeting.agenda.length > 0 && (
                <span className="text-zinc-600">&middot; {meeting.agenda.length} agenda items</span>
              )}
            </div>
          </div>
        );
      }

      case 'document': {
        const doc = item.data as ResolutionDocument;
        const docAgent = agentProfiles[doc.agent_id];
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getResolutionItemIcon(item.type)}</span>
              <span className="font-medium text-zinc-200 text-sm">{doc.title}</span>
              <span className="text-xs text-zinc-600">{getResolutionItemTypeLabel(item.type)}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{doc.description}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
              <span>Type: {doc.type}</span>
              <span>
                Author: {docAgent ? `${docAgent.emoji} ${docAgent.name}` : doc.agent_id}
              </span>
            </div>
          </div>
        );
      }

      default: {
        const data = item.data as Record<string, any>;
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getResolutionItemIcon(item.type)}</span>
              <span className="font-medium text-zinc-200 text-sm">
                {data.title || data.name || data.customer || 'Item'}
              </span>
              <span className="text-xs text-zinc-600">{getResolutionItemTypeLabel(item.type)}</span>
            </div>
            {(data.description || data.topic) && (
              <div className="text-xs text-zinc-400 mt-1 line-clamp-2">
                {data.description || data.topic}
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className={cn('border rounded-lg p-3', statusColor)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">{renderItemDetails()}</div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge}
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => onApprove(sessionId, item.id)}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
                title="Approve"
              >
                &#x2713;
              </button>
              <button
                onClick={() => onReject(sessionId, item.id)}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                title="Reject"
              >
                &#x2715;
              </button>
            </>
          )}
        </div>
      </div>

      {/* Source excerpt */}
      {(item.data as any).source_excerpt && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          {isExpanded ? '▼' : '▶'} View source
        </button>
      )}

      {isExpanded && (item.data as any).source_excerpt && (
        <div className="mt-2 pl-3 border-l-2 border-zinc-700 text-xs text-zinc-400 italic">
          "{(item.data as any).source_excerpt}"
        </div>
      )}

      {item.error && (
        <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
          Error: {item.error}
        </div>
      )}

      {item.created_id && (
        <div className="mt-2 text-xs text-blue-400">Created: {item.created_id}</div>
      )}
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
