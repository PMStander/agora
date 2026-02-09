import { useState } from 'react';
import { useCrmStore } from '../../stores/crm';
import { useSavedViews } from '../../hooks/useSavedViews';
import type { SavedViewEntityType, ViewFilters } from '../../types/crm';
import {
  LIFECYCLE_STATUS_CONFIG,
  DEAL_STATUS_CONFIG,
  SAVED_VIEW_ICONS,
  SAVED_VIEW_COLORS,
} from '../../types/crm';
import { getAgent } from '../../types/supabase';

interface SaveViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: SavedViewEntityType;
}

export function SaveViewModal({ isOpen, onClose, entityType }: SaveViewModalProps) {
  const { saveView } = useSavedViews();
  const filters = useCrmStore((s) => s.filters);
  const searchQuery = useCrmStore((s) => s.searchQuery);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  if (!isOpen) return null;

  // Build the ViewFilters from current store state
  const currentFilters: ViewFilters = {
    lifecycleStatus: filters.lifecycleStatus,
    dealStatus: filters.dealStatus,
    ownerAgent: filters.ownerAgent,
    tags: filters.tags,
    searchQuery: searchQuery || undefined,
  };

  // Count active filters for display
  const activeFilterDescriptions: string[] = [];
  if (filters.lifecycleStatus !== 'all') {
    activeFilterDescriptions.push(
      `Status: ${LIFECYCLE_STATUS_CONFIG[filters.lifecycleStatus]?.label ?? filters.lifecycleStatus}`
    );
  }
  if (filters.dealStatus !== 'all') {
    activeFilterDescriptions.push(
      `Deal: ${DEAL_STATUS_CONFIG[filters.dealStatus]?.label ?? filters.dealStatus}`
    );
  }
  if (filters.ownerAgent) {
    const agent = getAgent(filters.ownerAgent);
    activeFilterDescriptions.push(`Agent: ${agent ? agent.name : filters.ownerAgent}`);
  }
  if (filters.tags.length > 0) {
    activeFilterDescriptions.push(`Tags: ${filters.tags.join(', ')}`);
  }
  if (searchQuery) {
    activeFilterDescriptions.push(`Search: "${searchQuery}"`);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await saveView(name.trim(), entityType, currentFilters, {
        icon: icon || undefined,
        color: color || undefined,
        isPinned,
      });
      setName('');
      setIcon('');
      setColor('');
      setIsPinned(false);
      onClose();
    } catch (err) {
      console.error('Failed to save view:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedColorConfig = SAVED_VIEW_COLORS.find((c) => c.value === color);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Save View</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">View Name *</label>
            <div className="flex items-center gap-2">
              {/* Icon button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-10 h-10 flex items-center justify-center bg-zinc-800 border border-zinc-700 rounded-lg text-lg hover:border-zinc-600 transition-colors"
                >
                  {icon || '+'}
                </button>
                {showIconPicker && (
                  <div className="absolute top-12 left-0 z-10 bg-zinc-800 border border-zinc-700 rounded-lg p-2 grid grid-cols-4 gap-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => { setIcon(''); setShowIconPicker(false); }}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-700 text-xs text-zinc-500"
                    >
                      --
                    </button>
                    {SAVED_VIEW_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => { setIcon(emoji); setShowIconPicker(false); }}
                        className={`w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-700 ${
                          icon === emoji ? 'bg-zinc-700 ring-1 ring-amber-500/50' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Hot Leads"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Color</label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setColor('')}
                className={`w-7 h-7 rounded-full border-2 transition-colors ${
                  !color
                    ? 'border-zinc-400 bg-zinc-700'
                    : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                }`}
                title="None"
              />
              {SAVED_VIEW_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-colors ${c.bg} ${
                    color === c.value
                      ? 'border-zinc-300 ring-1 ring-zinc-300/30'
                      : 'border-transparent hover:border-zinc-600'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Pin toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={`relative w-9 h-5 rounded-full transition-colors ${
                isPinned ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
              onClick={() => setIsPinned(!isPinned)}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  isPinned ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
              Pin to sidebar
            </span>
          </label>

          {/* Filter preview */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Filters being saved</label>
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3">
              {activeFilterDescriptions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterDescriptions.map((desc, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-1 rounded-md ${
                        selectedColorConfig
                          ? `${selectedColorConfig.bg} ${selectedColorConfig.text}`
                          : 'bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {desc}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-zinc-500">No filters active (all records)</span>
              )}
              <div className="mt-2 text-xs text-zinc-600">
                Entity: {entityType}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save View'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
