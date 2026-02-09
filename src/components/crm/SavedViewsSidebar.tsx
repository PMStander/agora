import { useState, useRef, useEffect } from 'react';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useCrmStore } from '../../stores/crm';
import type { SavedView, SavedViewEntityType } from '../../types/crm';
import { SAVED_VIEW_COLORS } from '../../types/crm';

interface SavedViewsSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function getColorClasses(colorValue: string | null) {
  if (!colorValue) return { bg: 'bg-zinc-500/20', text: 'text-zinc-400' };
  return (
    SAVED_VIEW_COLORS.find((c) => c.value === colorValue) ?? {
      bg: 'bg-zinc-500/20',
      text: 'text-zinc-400',
    }
  );
}

interface ContextMenuState {
  viewId: string;
  x: number;
  y: number;
}

export function SavedViewsSidebar({ collapsed, onToggleCollapse }: SavedViewsSidebarProps) {
  const { views, pinnedViews, applyView, clearActiveView, deleteView, togglePin } =
    useSavedViews();
  const activeViewId = useCrmStore((s) => s.activeViewId);
  const activeSubTab = useCrmStore((s) => s.activeSubTab);

  const [allExpanded, setAllExpanded] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const contextRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Filter non-pinned views by the current sub-tab's entity type
  const entityType: SavedViewEntityType =
    activeSubTab === 'contacts' || activeSubTab === 'companies' || activeSubTab === 'deals'
      ? activeSubTab
      : 'contacts';

  const unpinnedViews = views.filter(
    (v) => !v.is_pinned && v.entity_type === entityType
  );

  const handleContextMenu = (e: React.MouseEvent, viewId: string) => {
    e.preventDefault();
    setContextMenu({ viewId, x: e.clientX, y: e.clientY });
  };

  const handleViewClick = (view: SavedView) => {
    if (activeViewId === view.id) {
      clearActiveView();
    } else {
      applyView(view);
    }
  };

  const handleDelete = async (viewId: string) => {
    setContextMenu(null);
    await deleteView(viewId);
  };

  const handleTogglePin = async (viewId: string) => {
    setContextMenu(null);
    await togglePin(viewId);
  };

  const { updateView } = useSavedViews();

  const handleStartRename = (view: SavedView) => {
    setContextMenu(null);
    setEditingViewId(view.id);
    setEditName(view.name);
  };

  const handleRenameSubmit = async () => {
    if (editingViewId && editName.trim()) {
      await updateView(editingViewId, { name: editName.trim() });
    }
    setEditingViewId(null);
    setEditName('');
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 w-10 border-r border-zinc-800 bg-zinc-900/30 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Expand views sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {/* Collapsed pinned view icons */}
        <div className="flex flex-col items-center gap-1 mt-2">
          {pinnedViews.slice(0, 6).map((view) => (
            <button
              key={view.id}
              onClick={() => handleViewClick(view)}
              className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
                activeViewId === view.id
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                  : 'hover:bg-zinc-800 text-zinc-500'
              }`}
              title={view.name}
            >
              {view.icon || view.name.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const renderViewItem = (view: SavedView, compact = false) => {
    const colorCls = getColorClasses(view.color);
    const isActive = activeViewId === view.id;
    const isEditing = editingViewId === view.id;

    return (
      <div
        key={view.id}
        onClick={() => !isEditing && handleViewClick(view)}
        onContextMenu={(e) => handleContextMenu(e, view.id)}
        className={`
          group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
          ${isActive
            ? `${colorCls.bg} ${colorCls.text} ring-1 ring-current/20`
            : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-300'
          }
          ${compact ? 'text-xs' : 'text-sm'}
        `}
      >
        {view.icon && <span className="shrink-0">{view.icon}</span>}
        {!view.icon && (
          <span className={`w-2 h-2 rounded-full shrink-0 ${colorCls.bg}`} />
        )}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') { setEditingViewId(null); setEditName(''); }
            }}
            className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1">{view.name}</span>
        )}
        {!isEditing && (
          <span className="text-[10px] text-zinc-600 group-hover:text-zinc-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {view.entity_type.slice(0, 3)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-52 border-r border-zinc-800 bg-zinc-900/30 shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Views</span>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Collapse sidebar"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Clear active view */}
        {activeViewId && (
          <button
            onClick={clearActiveView}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear view
          </button>
        )}

        {/* Pinned views */}
        {pinnedViews.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider px-2 mb-1">
              Pinned
            </div>
            <div className="space-y-0.5">
              {pinnedViews.map((view) => renderViewItem(view))}
            </div>
          </div>
        )}

        {/* All views for current entity type */}
        <div>
          <button
            onClick={() => setAllExpanded(!allExpanded)}
            className="w-full flex items-center gap-1 text-[10px] font-medium text-zinc-600 uppercase tracking-wider px-2 mb-1 hover:text-zinc-400 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${allExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            All {entityType}
          </button>
          {allExpanded && (
            <div className="space-y-0.5">
              {unpinnedViews.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-zinc-600">
                  No saved views
                </div>
              ) : (
                unpinnedViews.map((view) => renderViewItem(view, true))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-50 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {(() => {
            const view = views.find((v) => v.id === contextMenu.viewId);
            if (!view) return null;
            return (
              <>
                <button
                  onClick={() => handleStartRename(view)}
                  className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={() => handleTogglePin(contextMenu.viewId)}
                  className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  {view.is_pinned ? 'Unpin' : 'Pin to sidebar'}
                </button>
                <div className="border-t border-zinc-700 my-1" />
                <button
                  onClick={() => handleDelete(contextMenu.viewId)}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
                >
                  Delete
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
