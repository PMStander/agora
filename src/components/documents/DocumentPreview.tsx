import type { CrmDocument } from '../../types/documents';
import { DOC_TYPE_CONFIG } from '../../types/documents';

// ─── Component ──────────────────────────────────────────────────────────────

interface DocumentPreviewProps {
  document: CrmDocument;
  signedUrl?: string | null;
}

/**
 * Simple inline preview for common file types.
 * - Images: show thumbnail via signed URL
 * - PDFs: show PDF icon badge
 * - Others: show doc type icon
 */
export function DocumentPreview({ document: doc, signedUrl }: DocumentPreviewProps) {
  const typeConfig = DOC_TYPE_CONFIG[doc.doc_type];
  const isImage = doc.mime_type?.startsWith('image/');
  const isPdf = doc.mime_type === 'application/pdf';

  if (isImage && signedUrl) {
    return (
      <div className="w-10 h-10 rounded border border-zinc-700 overflow-hidden shrink-0">
        <img
          src={signedUrl}
          alt={doc.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="w-10 h-10 rounded border border-zinc-700 bg-red-500/10 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-red-400">PDF</span>
      </div>
    );
  }

  // Default: show type icon
  return (
    <div className="w-10 h-10 rounded border border-zinc-700 bg-zinc-800 flex items-center justify-center shrink-0">
      <span className="text-lg">{typeConfig.icon}</span>
    </div>
  );
}
