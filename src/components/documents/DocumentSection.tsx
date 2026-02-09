import { useState, useEffect, useCallback } from 'react';
import { useDocuments } from '../../hooks/useDocuments';
import type { CrmDocument, DocType, DocumentEntityType } from '../../types/documents';
import { DocumentList } from './DocumentList';
import { DocumentUploader } from './DocumentUploader';

// ─── Component ──────────────────────────────────────────────────────────────

interface DocumentSectionProps {
  entityType: DocumentEntityType;
  entityId: string;
  /** Section title -- defaults to "Documents" */
  title?: string;
}

/**
 * Reusable documents section to embed in any CRM detail panel.
 * Handles fetching, uploading, downloading, and deleting documents
 * for a given entity.
 */
export function DocumentSection({ entityType, entityId, title = 'Documents' }: DocumentSectionProps) {
  const {
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    uploading,
    uploadProgress,
  } = useDocuments();

  const [documents, setDocuments] = useState<CrmDocument[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch documents when entity changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDocuments(entityType, entityId).then((docs) => {
      if (!cancelled) {
        setDocuments(docs);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, fetchDocuments]);

  const handleUpload = useCallback(
    async (
      file: File,
      metadata: { title: string; doc_type: DocType; description?: string }
    ): Promise<boolean> => {
      const entityKey = `${entityType}_id` as const;
      const doc = await uploadDocument(file, {
        ...metadata,
        [entityKey]: entityId,
      });
      if (doc) {
        setDocuments((prev) => [doc, ...prev]);
        return true;
      }
      return false;
    },
    [entityType, entityId, uploadDocument]
  );

  const handleDelete = useCallback(
    async (doc: CrmDocument) => {
      const success = await deleteDocument(doc);
      if (success) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      }
    },
    [deleteDocument]
  );

  const handleDownload = useCallback(
    (doc: CrmDocument) => {
      downloadDocument(doc);
    },
    [downloadDocument]
  );

  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
        {title} ({documents.length})
      </h4>
      <DocumentList
        documents={documents}
        onDownload={handleDownload}
        onDelete={handleDelete}
        loading={loading}
      />
      <div className="mt-2">
        <DocumentUploader
          onUpload={handleUpload}
          uploading={uploading}
          uploadProgress={uploadProgress}
        />
      </div>
    </div>
  );
}
