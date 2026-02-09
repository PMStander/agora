import { useState } from 'react';
import { useCrmStore } from '../../stores/crm';
import type { SavedViewEntityType } from '../../types/crm';
import { SaveViewModal } from './SaveViewModal';

interface SaveViewButtonProps {
  entityType: SavedViewEntityType;
}

export function SaveViewButton({ entityType }: SaveViewButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const filters = useCrmStore((s) => s.filters);
  const searchQuery = useCrmStore((s) => s.searchQuery);

  // Only show when there are active filters
  const hasActiveFilters =
    filters.lifecycleStatus !== 'all' ||
    filters.dealStatus !== 'all' ||
    filters.ownerAgent !== null ||
    filters.tags.length > 0 ||
    searchQuery.length > 0;

  if (!hasActiveFilters) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-400 border border-zinc-700 rounded-lg hover:text-amber-400 hover:border-amber-500/40 transition-colors"
        title="Save current filters as a view"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        Save View
      </button>

      <SaveViewModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        entityType={entityType}
      />
    </>
  );
}
