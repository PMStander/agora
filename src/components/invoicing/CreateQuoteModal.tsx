import { QuoteEditor } from './QuoteEditor';

// ─── Props ──────────────────────────────────────────────────────────────────

interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillDealId?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateQuoteModal({ isOpen, onClose, prefillDealId }: CreateQuoteModalProps) {
  if (!isOpen) return null;
  return <QuoteEditor onClose={onClose} prefillDealId={prefillDealId} />;
}
