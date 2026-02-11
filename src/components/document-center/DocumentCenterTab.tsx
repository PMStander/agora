import { useDocumentCenter } from '../../hooks/useDocumentCenter';
import { DocumentCenterFilters } from './DocumentCenterFilters';
import { DocumentCenterList } from './DocumentCenterList';

export function DocumentCenterTab() {
  const { documents, loading, counts } = useDocumentCenter();

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-100">Document Center</h1>
        <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">
          {counts.total}
        </span>
        {counts.awaitingApproval > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
            {counts.awaitingApproval} awaiting approval
          </span>
        )}
      </div>

      {/* Filters */}
      <DocumentCenterFilters />

      {/* Document List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Loading documents...
        </div>
      ) : (
        <DocumentCenterList documents={documents} />
      )}
    </div>
  );
}
