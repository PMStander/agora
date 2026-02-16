// ─── Resolution Package Panel ────────────────────────────────────────────────

import { useState } from 'react';
import { useAgentStore } from '../../stores/agents';
import { useBoardroomResolution } from '../../hooks/useBoardroomResolution';
import { getResolutionItemIcon, getResolutionItemTypeLabel } from '../../lib/boardroomResolution';
import type { 
  BoardroomSession, 
  BoardroomSessionMetadata,
  ResolutionPackageItem,
  ResolutionMission,
  ResolutionFollowUpMeeting,
  ResolutionDocument,
} from '../../types/boardroom';
import { cn } from '../../lib/utils';

interface ResolutionPackagePanelProps {
  session: BoardroomSession;
  onClose: () => void;
}

export function ResolutionPackagePanel({ session, onClose }: ResolutionPackagePanelProps) {
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const { approveResolutionItem, rejectResolutionItem, approveAllItems, executeResolutionPackage } = useBoardroomResolution();
  const [isExecuting, setIsExecuting] = useState(false);

  const metadata = session.metadata as BoardroomSessionMetadata;
  const resolutionPackage = metadata?.resolution_package;

  if (!resolutionPackage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md">
          <h2 className="text-lg font-semibold mb-4">Resolution Package</h2>
          <p className="text-zinc-400 text-sm">No resolution package available for this session.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const pendingItems = resolutionPackage.items.filter(item => item.status === 'pending');
  const approvedItems = resolutionPackage.items.filter(item => item.status === 'approved');
  const createdItems = resolutionPackage.items.filter(item => item.status === 'created');
  const rejectedItems = resolutionPackage.items.filter(item => item.status === 'rejected');

  const handleApproveAll = async () => {
    await approveAllItems(session.id);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await executeResolutionPackage(session.id);
    } finally {
      setIsExecuting(false);
    }
  };

  const groupedItems = resolutionPackage.items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, ResolutionPackageItem[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Resolution Package</h2>
              <p className="text-sm text-zinc-400">{session.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-zinc-400">{pendingItems.length} pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-zinc-400">{approvedItems.length + createdItems.length} approved</span>
            </div>
            {rejectedItems.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-zinc-400">{rejectedItems.length} rejected</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {pendingItems.length > 0 && (
          <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-3">
            <button
              onClick={handleApproveAll}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
            >
              Approve All ({pendingItems.length})
            </button>
            {resolutionPackage.mode === 'propose' && (
              <span className="text-xs text-zinc-500">
                Review and approve items before execution
              </span>
            )}
          </div>
        )}

        {/* Execute button */}
        {approvedItems.length > 0 && (
          <div className="px-6 py-3 border-b border-zinc-800 bg-amber-500/10 flex items-center gap-3">
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={cn(
                "px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors",
                isExecuting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isExecuting ? 'Executing...' : `Execute ${approvedItems.length} Items`}
            </button>
            <span className="text-xs text-amber-200">
              Create missions, sessions, and other objects from approved items
            </span>
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {Object.entries(groupedItems).map(([type, items]) => (
            <div key={type}>
              <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <span>{getResolutionItemIcon(type as any)}</span>
                <span>{getResolutionItemTypeLabel(type as any)}</span>
                <span className="text-zinc-600">({items.length})</span>
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <ResolutionItem
                    key={item.id}
                    item={item}
                    sessionId={session.id}
                    agentProfiles={agentProfiles}
                    onApprove={approveResolutionItem}
                    onReject={rejectResolutionItem}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Resolution Item Component ───────────────────────────────────────────────

interface ResolutionItemProps {
  item: ResolutionPackageItem;
  sessionId: string;
  agentProfiles: Record<string, any>;
  onApprove: (sessionId: string, itemId: string) => void;
  onReject: (sessionId: string, itemId: string) => void;
}

function ResolutionItem({ item, sessionId, agentProfiles, onApprove, onReject }: ResolutionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusColor = {
    pending: 'border-amber-500/30 bg-amber-500/5',
    approved: 'border-green-500/30 bg-green-500/5',
    created: 'border-blue-500/30 bg-blue-500/5',
    rejected: 'border-red-500/30 bg-red-500/5',
  }[item.status];

  const statusBadge = {
    pending: <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Pending</span>,
    approved: <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Approved</span>,
    created: <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Created</span>,
    rejected: <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Rejected</span>,
  }[item.status];

  const renderItemDetails = () => {
    switch (item.type) {
      case 'mission':
        const mission = item.data as ResolutionMission;
        const agent = agentProfiles[mission.agent_id];
        return (
          <div>
            <div className="font-medium text-zinc-200">{mission.title}</div>
            <div className="text-sm text-zinc-400 mt-1">{mission.description}</div>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-zinc-500">
                Assigned: {agent ? `${agent.emoji} ${agent.name}` : mission.agent_id}
              </span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full",
                mission.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                mission.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                mission.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                'bg-zinc-600/20 text-zinc-400'
              )}>
                {mission.priority}
              </span>
            </div>
          </div>
        );
      
      case 'follow_up':
        const meeting = item.data as ResolutionFollowUpMeeting;
        return (
          <div>
            <div className="font-medium text-zinc-200">{meeting.title}</div>
            <div className="text-sm text-zinc-400 mt-1">{meeting.topic}</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
              <span>Participants: {meeting.participant_agent_ids.map(id => {
                const p = agentProfiles[id];
                return p ? p.emoji : '?';
              }).join(' ')}</span>
            </div>
          </div>
        );

      case 'document':
        const doc = item.data as ResolutionDocument;
        const docAgent = agentProfiles[doc.agent_id];
        return (
          <div>
            <div className="font-medium text-zinc-200">{doc.title}</div>
            <div className="text-sm text-zinc-400 mt-1">{doc.description}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
              <span>Type: {doc.type}</span>
              <span>Author: {docAgent ? `${docAgent.emoji} ${docAgent.name}` : doc.agent_id}</span>
            </div>
          </div>
        );

      default:
        return (
          <div className="font-medium text-zinc-200">
            {JSON.stringify(item.data).slice(0, 100)}...
          </div>
        );
    }
  };

  return (
    <div className={cn("border rounded-lg p-3", statusColor)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {renderItemDetails()}
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => onApprove(sessionId, item.id)}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
                title="Approve"
              >
                ✓
              </button>
              <button
                onClick={() => onReject(sessionId, item.id)}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                title="Reject"
              >
                ✕
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
        <div className="mt-2 text-xs text-blue-400">
          Created: {item.created_id}
        </div>
      )}
    </div>
  );
}
