import { useDocumentCenterStore } from '../../stores/documentCenter';
import type { DocumentCenterItem } from '../../types/documentCenter';
import { DocumentCenterListItem } from './DocumentCenterListItem';

interface Props {
  documents: DocumentCenterItem[];
}

export function DocumentCenterList({ documents }: Props) {
  const selectedId = useDocumentCenterStore((s) => s.selectedDocumentId);
  const selectDocument = useDocumentCenterStore((s) => s.selectDocument);

  if (documents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        No documents match your filters
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {documents.map((doc) => (
        <DocumentCenterListItem
          key={doc.id}
          item={doc}
          isSelected={selectedId === doc.id}
          onClick={() => selectDocument(selectedId === doc.id ? null : doc.id)}
        />
      ))}
    </div>
  );
}
