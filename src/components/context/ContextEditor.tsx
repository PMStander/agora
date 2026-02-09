import { useState, useEffect } from 'react';
import type { ContextDocument } from '../../types/context';
import { useProjectContext } from '../../hooks/useProjectContext';
import { ContextDocumentView } from './ContextDocumentView';
import { ContextDocumentEditor } from './ContextDocumentEditor';
import { RevisionHistory } from './RevisionHistory';

interface ContextEditorProps {
  projectContextId: string;
  onBack: () => void;
}

export function ContextEditor({ projectContextId, onBack }: ContextEditorProps) {
  const { getDocuments, updateDocument } = useProjectContext();
  const [documents, setDocuments] = useState<ContextDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDocuments(projectContextId).then((docs) => {
      setDocuments(docs);
      if (docs.length > 0 && !selectedDocId) {
        setSelectedDocId(docs[0].id);
      }
      setLoading(false);
    });
  }, [projectContextId, getDocuments, selectedDocId]);

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Loading documents...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-zinc-800">
        <button
          onClick={onBack}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Back
        </button>
        <div className="flex-1" />
        {/* Document tabs */}
        {documents.map((doc) => (
          <button
            key={doc.id}
            onClick={() => {
              setSelectedDocId(doc.id);
              setEditing(false);
            }}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              doc.id === selectedDocId
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {doc.title}
          </button>
        ))}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            showHistory
              ? 'bg-zinc-700 text-zinc-300'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedDoc ? (
          <div className="flex gap-4">
            <div className={showHistory ? 'flex-1' : 'w-full'}>
              {editing ? (
                <ContextDocumentEditor
                  document={selectedDoc}
                  onSave={(content, version) =>
                    updateDocument(selectedDoc.id, content, version)
                  }
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <ContextDocumentView
                  document={selectedDoc}
                  onEdit={() => setEditing(true)}
                />
              )}
            </div>
            {showHistory && selectedDoc && (
              <div className="w-64 border-l border-zinc-800 pl-4">
                <RevisionHistory documentId={selectedDoc.id} />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-zinc-500 text-sm py-8">
            No documents in this context
          </div>
        )}
      </div>
    </div>
  );
}
