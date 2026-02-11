import { useState, useEffect, useMemo } from 'react';
import { useInvoicingStore, useSelectedQuote } from '../../stores/invoicing';
import { useCrmStore } from '../../stores/crm';
import { useInvoicing } from '../../hooks/useInvoicing';
import { QUOTE_STATUS_CONFIG } from '../../types/invoicing';
import type { QuoteStatus, QuoteLineItem } from '../../types/invoicing';
import { DocumentSection } from '../documents/DocumentSection';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };
  return map[color] || map.zinc;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface QuoteDetailProps {
  onEdit: (quoteId: string) => void;
}

export function QuoteDetail({ onEdit }: QuoteDetailProps) {
  const quote = useSelectedQuote();
  const selectQuote = useInvoicingStore((s) => s.selectQuote);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const openProfileWorkspace = useCrmStore((s) => s.openProfileWorkspace);
  const { updateQuoteStatus, deleteQuote, convertQuoteToInvoice, fetchQuoteLineItems } =
    useInvoicing();

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (quote) {
      fetchQuoteLineItems(quote.id).then(setLineItems);
      setConfirmDelete(false);
    }
  }, [quote?.id, fetchQuoteLineItems]);

  const contact = useMemo(
    () => (quote?.contact_id ? contacts.find((c) => c.id === quote.contact_id) : null),
    [contacts, quote?.contact_id]
  );

  const company = useMemo(
    () => (quote?.company_id ? companies.find((c) => c.id === quote.company_id) : null),
    [companies, quote?.company_id]
  );

  if (!quote) return null;

  const statusConfig = QUOTE_STATUS_CONFIG[quote.status];

  const handleStatusChange = (status: QuoteStatus) => {
    updateQuoteStatus(quote.id, status);
  };

  const handleConvert = async () => {
    setConverting(true);
    await convertQuoteToInvoice(quote.id);
    setConverting(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteQuote(quote.id);
    selectQuote(null);
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Quote Details</h2>
        <button
          onClick={() => selectQuote(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Header Info */}
        <div className="text-center">
          <h3 className="text-lg font-medium text-zinc-100">{quote.quote_number}</h3>
          {quote.title && (
            <p className="text-sm text-zinc-400 mt-1">{quote.title}</p>
          )}
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {formatCurrency(quote.total, quote.currency)}
          </div>
          <span
            className={`inline-block mt-2 px-3 py-0.5 text-xs rounded-full ${statusBadgeClasses(statusConfig.color)}`}
          >
            {statusConfig.label}
          </span>
          <button
            onClick={() => openProfileWorkspace('quote', quote.id, quote.quote_number)}
            className="mt-2 w-full px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-center"
          >
            Open Full Profile
          </button>
        </div>

        {/* Contact & Company */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Contact & Company
          </h4>
          {contact ? (
            <div className="text-sm text-zinc-300">
              {contact.first_name} {contact.last_name}
              {contact.email && (
                <span className="text-zinc-500 block text-xs">{contact.email}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">No contact linked</p>
          )}
          {company && (
            <div className="text-sm text-zinc-400 mt-1">{company.name}</div>
          )}
        </div>

        {/* Dates */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Dates
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Created</span>
              <span className="text-zinc-300">{new Date(quote.created_at).toLocaleDateString()}</span>
            </div>
            {quote.valid_until && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Valid Until</span>
                <span className="text-zinc-300">{new Date(quote.valid_until).toLocaleDateString()}</span>
              </div>
            )}
            {quote.accepted_at && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Accepted</span>
                <span className="text-green-400">{new Date(quote.accepted_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Totals
          </h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span className="text-zinc-300">{formatCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            {quote.discount_total > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Discounts</span>
                <span className="text-red-400">-{formatCurrency(quote.discount_total, quote.currency)}</span>
              </div>
            )}
            {quote.tax_total > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Tax</span>
                <span className="text-zinc-300">{formatCurrency(quote.tax_total, quote.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-zinc-700 pt-1">
              <span className="text-zinc-300">Total</span>
              <span className="text-amber-400">{formatCurrency(quote.total, quote.currency)}</span>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Line Items ({lineItems.length})
          </h4>
          {lineItems.length === 0 ? (
            <p className="text-xs text-zinc-600">No line items</p>
          ) : (
            <div className="space-y-1.5">
              {lineItems.map((li) => (
                <div
                  key={li.id}
                  className="flex items-start gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-300 truncate">{li.name}</div>
                    <div className="text-[10px] text-zinc-600">
                      {li.quantity} x {formatCurrency(li.unit_price, quote.currency)}
                      {li.discount_percent > 0 && ` (-${li.discount_percent}%)`}
                    </div>
                  </div>
                  <span className="text-xs text-amber-400 shrink-0">
                    {formatCurrency(li.subtotal, quote.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attachments */}
        <DocumentSection entityType="quote" entityId={quote.id} title="Attachments" />

        {/* Notes */}
        {quote.introduction && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Introduction
            </h4>
            <p className="text-xs text-zinc-400">{quote.introduction}</p>
          </div>
        )}
        {quote.internal_note && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Internal Note
            </h4>
            <p className="text-xs text-zinc-400">{quote.internal_note}</p>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        <button
          onClick={() => onEdit(quote.id)}
          className="w-full px-3 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
        >
          Edit Quote
        </button>

        {/* Status actions */}
        {quote.status === 'draft' && (
          <button
            onClick={() => handleStatusChange('sent')}
            className="w-full px-3 py-2 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            Mark as Sent
          </button>
        )}
        {(quote.status === 'sent' || quote.status === 'viewed') && (
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange('accepted')}
              className="flex-1 px-3 py-2 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              Mark Accepted
            </button>
            <button
              onClick={() => handleStatusChange('declined')}
              className="flex-1 px-3 py-2 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Mark Declined
            </button>
          </div>
        )}
        {quote.status === 'accepted' && !quote.converted_to_invoice_id && (
          <button
            onClick={handleConvert}
            disabled={converting}
            className="w-full px-3 py-2 text-xs bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          >
            {converting ? 'Converting...' : 'Convert to Invoice'}
          </button>
        )}

        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Quote'}
        </button>
      </div>
    </div>
  );
}
