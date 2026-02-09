import { useState, useRef, useCallback } from 'react';
import type { DocType } from '../../types/documents';
import { DOC_TYPE_CONFIG } from '../../types/documents';
import { formatFileSize } from '../../lib/csvUtils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PendingFile {
  file: File;
  title: string;
  doc_type: DocType;
  description: string;
}

interface DocumentUploaderProps {
  onUpload: (
    file: File,
    metadata: { title: string; doc_type: DocType; description?: string }
  ) => Promise<boolean>;
  uploading?: boolean;
  uploadProgress?: number;
}

const DOC_TYPES = Object.entries(DOC_TYPE_CONFIG) as [DocType, (typeof DOC_TYPE_CONFIG)[DocType]][];

// ─── Component ──────────────────────────────────────────────────────────────

export function DocumentUploader({ onUpload, uploading, uploadProgress }: DocumentUploaderProps) {
  const [expanded, setExpanded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newPending: PendingFile[] = Array.from(files).map((file) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ''), // Strip extension for default title
      doc_type: 'file' as DocType,
      description: '',
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
    setExpanded(true);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        // Reset input so the same file can be selected again
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  const updatePending = (idx: number, updates: Partial<PendingFile>) => {
    setPendingFiles((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...updates } : p))
    );
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadAll = async () => {
    for (let i = pendingFiles.length - 1; i >= 0; i--) {
      const pf = pendingFiles[i];
      const success = await onUpload(pf.file, {
        title: pf.title || pf.file.name,
        doc_type: pf.doc_type,
        description: pf.description || undefined,
      });
      if (success) {
        setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));
      }
    }
    // Collapse if all uploaded
    setPendingFiles((prev) => {
      if (prev.length === 0) setExpanded(false);
      return prev;
    });
  };

  // Collapsed state: minimal drop zone
  if (!expanded && pendingFiles.length === 0) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-lg p-2 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-amber-500/50 bg-amber-500/5'
            : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'
        }`}
      >
        <p className="text-[10px] text-zinc-500">
          Drop files here or <span className="text-amber-400">browse</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-amber-500/50 bg-amber-500/10'
            : 'border-zinc-700 hover:border-zinc-500'
        }`}
      >
        <p className="text-xs text-zinc-400">
          Drop files here or <span className="text-amber-400">browse</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Pending files */}
      {pendingFiles.map((pf, idx) => (
        <div
          key={`${pf.file.name}-${idx}`}
          className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-2.5 space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-300 truncate">{pf.file.name}</div>
              <div className="text-[10px] text-zinc-600">{formatFileSize(pf.file.size)}</div>
            </div>
            <button
              onClick={() => removePending(idx)}
              className="text-zinc-500 hover:text-red-400 p-0.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Title */}
          <input
            type="text"
            value={pf.title}
            onChange={(e) => updatePending(idx, { title: e.target.value })}
            placeholder="Title"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none transition-colors"
          />

          {/* Doc type selector */}
          <select
            value={pf.doc_type}
            onChange={(e) => updatePending(idx, { doc_type: e.target.value as DocType })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
          >
            {DOC_TYPES.map(([key, config]) => (
              <option key={key} value={key}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>

          {/* Optional description */}
          <input
            type="text"
            value={pf.description}
            onChange={(e) => updatePending(idx, { description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none transition-colors"
          />
        </div>
      ))}

      {/* Upload button + progress */}
      {pendingFiles.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleUploadAll}
            disabled={uploading}
            className="flex-1 px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
          >
            {uploading
              ? `Uploading${uploadProgress ? ` ${uploadProgress}%` : '...'}`
              : `Upload ${pendingFiles.length === 1 ? 'File' : `${pendingFiles.length} Files`}`}
          </button>
          <button
            onClick={() => {
              setPendingFiles([]);
              setExpanded(false);
            }}
            className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Progress bar */}
      {uploading && uploadProgress != null && uploadProgress > 0 && (
        <div className="w-full bg-zinc-800 rounded-full h-1">
          <div
            className="bg-amber-500 h-1 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}
