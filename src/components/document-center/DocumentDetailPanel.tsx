import { useState, useEffect, useCallback } from 'react';
import { useDocumentCenterStore } from '../../stores/documentCenter';
import { useDocumentCenter } from '../../hooks/useDocumentCenter';
import { useAgentStore } from '../../stores/agents';
import { useMissionControlStore } from '../../stores/missionControl';
import { useCrmStore } from '../../stores/crm';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUS_CONFIG,
  SOURCE_LABELS,
} from '../../types/documentCenter';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400',
  active: 'bg-green-500/20 text-green-400',
  awaiting_approval: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-emerald-500/20 text-emerald-400',
  archived: 'bg-zinc-500/20 text-zinc-500',
  closed: 'bg-blue-500/20 text-blue-400',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Editor',
  reviewer: 'Reviewer',
  participant: 'Participant',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-400',
  editor: 'bg-blue-500/20 text-blue-400',
  reviewer: 'bg-purple-500/20 text-purple-400',
  participant: 'bg-zinc-500/20 text-zinc-400',
};

// ─── Component ─────────────────────────────────────────────────────────────

export function DocumentDetailPanel() {
  const selectedDocumentId = useDocumentCenterStore((s) => s.selectedDocumentId);
  const selectDocument = useDocumentCenterStore((s) => s.selectDocument);
  const { allDocuments, approveDocument, rejectDocument, fetchFullContent } = useDocumentCenter();
  const allAgents = useAgentStore((s) => s.teams).flatMap((t) => t.agents);
  const setActiveTab = useMissionControlStore((s) => s.setActiveTab);
  const selectMission = useMissionControlStore((s) => s.selectMission);

  const [fullContent, setFullContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const item = allDocuments.find((d) => d.id === selectedDocumentId);

  // Fetch full content when item changes
  useEffect(() => {
    if (!item) {
      setFullContent(null);
      return;
    }

    setContentLoading(true);
    setFullContent(null);
    setShowRejectForm(false);
    setRejectNotes('');

    fetchFullContent(item).then((content) => {
      setFullContent(content);
      setContentLoading(false);
    }, () => {
      setFullContent('Failed to load content.');
      setContentLoading(false);
    });
  }, [item?.id, fetchFullContent]);

  // Navigation to linked entities
  const navigateToEntity = useCallback((type: string, id: string) => {
    switch (type) {
      case 'mission':
        setActiveTab('mission-control');
        selectMission(id);
        break;
      case 'project':
        setActiveTab('projects');
        break;
      case 'contact':
        setActiveTab('crm');
        useCrmStore.getState().selectContact(id);
        break;
      case 'company':
        setActiveTab('crm');
        useCrmStore.getState().selectCompany(id);
        break;
      case 'deal':
        setActiveTab('crm');
        useCrmStore.getState().selectDeal(id);
        break;
      case 'agent':
        setActiveTab('teams');
        useAgentStore.getState().openAgentWorkspace(id);
        break;
      case 'boardroom_session':
        // Stay on documents — no separate boardroom tab
        break;
    }
  }, [setActiveTab, selectMission]);

  const handleApprove = async () => {
    if (!item) return;
    setActionLoading(true);
    await approveDocument(item);
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!item || !rejectNotes.trim()) return;
    setActionLoading(true);
    await rejectDocument(item, rejectNotes.trim());
    setShowRejectForm(false);
    setRejectNotes('');
    setActionLoading(false);
  };

  if (!item) {
    return (
      <div className="w-96 border-l border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
        <p className="text-sm text-zinc-600">Select a document to view details</p>
      </div>
    );
  }

  const catConfig = DOCUMENT_CATEGORIES.find((c) => c.id === item.category);
  const statusConfig = DOCUMENT_STATUS_CONFIG[item.status];
  const statusColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.active;

  return (
    <div className="w-96 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-start gap-3">
        <span className="text-xl mt-0.5">{catConfig?.icon ?? '📄'}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100 leading-tight">{item.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusColor}`}>
              {statusConfig?.label ?? item.status}
            </span>
            <span className="text-[10px] text-zinc-600">{SOURCE_LABELS[item.source]}</span>
          </div>
        </div>
        <button
          onClick={() => selectDocument(null)}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Metadata section */}
        <div className="px-4 py-3 border-b border-zinc-800/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Metadata</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-zinc-500">Created</span>
            <span className="text-zinc-300">{formatDate(item.createdAt)}</span>
            <span className="text-zinc-500">Updated</span>
            <span className="text-zinc-300">{formatDate(item.updatedAt)}</span>
            {item.version != null && (
              <>
                <span className="text-zinc-500">Version</span>
                <span className="text-zinc-300">v{item.version}</span>
              </>
            )}
            {item.fileSize != null && (
              <>
                <span className="text-zinc-500">Size</span>
                <span className="text-zinc-300">{formatBytes(item.fileSize)}</span>
              </>
            )}
            {item.mimeType && (
              <>
                <span className="text-zinc-500">Type</span>
                <span className="text-zinc-300 truncate">{item.mimeType}</span>
              </>
            )}
          </div>
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contributors */}
        {item.contributors.length > 0 && (
          <div className="px-4 py-3 border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Contributors</span>
            <div className="mt-2 space-y-2">
              {item.contributors.map((contrib) => {
                const agent = allAgents.find((a) => a.id === contrib.agentId);
                return (
                  <div key={contrib.agentId} className="flex items-center gap-2">
                    <span className="text-sm">{agent?.emoji ?? '?'}</span>
                    <span className="text-xs text-zinc-300 flex-1 truncate">
                      {agent?.name ?? contrib.agentId}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${ROLE_COLORS[contrib.role] ?? ROLE_COLORS.participant}`}>
                      {ROLE_LABELS[contrib.role] ?? contrib.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Linked Entities */}
        {item.linkedEntities.length > 0 && (
          <div className="px-4 py-3 border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Linked To</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.linkedEntities.map((entity) => (
                <button
                  key={`${entity.type}-${entity.id}`}
                  onClick={() => navigateToEntity(entity.type, entity.id)}
                  className="px-2 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 transition-colors"
                  title={`Go to ${entity.type}: ${entity.label}`}
                >
                  {entityIcon(entity.type)} {entity.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Approval Section */}
        {item.requiresApproval && (
          <div className="px-4 py-3 border-b border-zinc-800/50">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Approval Required</span>
            {item.approvalData?.reviewNotes && (
              <div className="mt-2 p-2 rounded bg-zinc-800/50 text-xs text-zinc-400 italic">
                Previous notes: {item.approvalData.reviewNotes}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => setShowRejectForm(!showRejectForm)}
                disabled={actionLoading}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                Request Changes
              </button>
            </div>
            {showRejectForm && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Describe what changes are needed..."
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
                  rows={3}
                />
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !rejectNotes.trim()}
                  className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  Submit Changes Request
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content section */}
        <div className="px-4 py-3">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Content</span>
          <div className="mt-2">
            {contentLoading ? (
              <div className="text-xs text-zinc-600 animate-pulse">Loading content...</div>
            ) : item.contentType === 'file' && fullContent?.startsWith('http') ? (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-zinc-800/50 text-xs text-zinc-400">
                  <p>File: <span className="text-zinc-300">{item.title}</span></p>
                  {item.mimeType && <p className="mt-1">Type: {item.mimeType}</p>}
                  {item.fileSize && <p>Size: {formatBytes(item.fileSize)}</p>}
                </div>
                <a
                  href={fullContent}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </a>
              </div>
            ) : (
              <div className="text-xs text-zinc-300 whitespace-pre-wrap break-words leading-relaxed max-h-[50vh] overflow-y-auto">
                {fullContent || item.contentPreview || 'No content available.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Open Source */}
      <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center gap-2">
        <button
          onClick={() => {
            if (item.source === 'mission_statement' || item.source === 'mission_plan') {
              navigateToEntity('mission', item.sourceId);
            } else if (item.source === 'context_document') {
              setActiveTab('context');
            } else if (item.source === 'crm_document') {
              setActiveTab('crm');
            }
          }}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-center"
        >
          Open in {SOURCE_LABELS[item.source]}
        </button>
      </div>
    </div>
  );
}

// ─── Entity icon helper ──────────────────────────────────────────────────

function entityIcon(type: string): string {
  switch (type) {
    case 'mission': return '🎯';
    case 'project': return '📁';
    case 'contact': return '👤';
    case 'company': return '🏢';
    case 'deal': return '🤝';
    case 'quote': return '📋';
    case 'invoice': return '💰';
    case 'agent': return '🤖';
    case 'boardroom_session': return '🏛️';
    default: return '🔗';
  }
}
