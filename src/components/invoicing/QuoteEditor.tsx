import { useState, useEffect } from 'react';
import { useInvoicing } from '../../hooks/useInvoicing';
import { useInvoicingStore } from '../../stores/invoicing';
import { useCrmStore } from '../../stores/crm';
import { LineItemEditor, type LineItemDraft } from './LineItemEditor';

// ─── Props ──────────────────────────────────────────────────────────────────

interface QuoteEditorProps {
  quoteId?: string | null; // null = create mode
  prefillDealId?: string;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function QuoteEditor({ quoteId, prefillDealId, onClose }: QuoteEditorProps) {
  const { createQuote, updateQuoteDetails, fetchQuoteLineItems, saveQuoteLineItems } =
    useInvoicing();
  const quotes = useInvoicingStore((s) => s.quotes);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);

  const existingQuote = quoteId ? quotes.find((q) => q.id === quoteId) : null;
  const isEditMode = !!existingQuote;

  // ── Form State ──
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [dealId, setDealId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [validUntil, setValidUntil] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate form for edit mode
  useEffect(() => {
    if (existingQuote) {
      setTitle(existingQuote.title || '');
      setContactId(existingQuote.contact_id || '');
      setCompanyId(existingQuote.company_id || '');
      setDealId(existingQuote.deal_id || '');
      setCurrency(existingQuote.currency);
      setValidUntil(existingQuote.valid_until ? existingQuote.valid_until.split('T')[0] : '');
      setIntroduction(existingQuote.introduction || '');
      setTermsAndConditions(existingQuote.terms_and_conditions || '');
      setCustomerNote(existingQuote.customer_note || '');
      setInternalNote(existingQuote.internal_note || '');

      fetchQuoteLineItems(existingQuote.id).then((items) => {
        setLineItems(
          items.map((li) => ({
            id: li.id,
            product_id: li.product_id,
            variation_id: li.variation_id,
            name: li.name,
            description: li.description,
            sku: li.sku,
            quantity: li.quantity,
            unit_price: li.unit_price,
            discount_percent: li.discount_percent,
            tax_amount: li.tax_amount,
            sort_order: li.sort_order,
          }))
        );
      });
    }
  }, [existingQuote?.id, fetchQuoteLineItems]);

  // Prefill from deal
  useEffect(() => {
    if (prefillDealId && !isEditMode) {
      setDealId(prefillDealId);
      const deal = deals.find((d) => d.id === prefillDealId);
      if (deal) {
        setTitle(`Quote for ${deal.title}`);
        if (deal.contact_id) setContactId(deal.contact_id);
        if (deal.company_id) setCompanyId(deal.company_id);
        setCurrency(deal.currency);
      }
    }
  }, [prefillDealId, deals, isEditMode]);

  // Auto-populate company from contact
  useEffect(() => {
    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact?.company_id && !companyId) {
        setCompanyId(contact.company_id);
      }
    }
  }, [contactId, contacts, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isEditMode && existingQuote) {
        // Update quote details
        await updateQuoteDetails(existingQuote.id, {
          title: title.trim() || null,
          contact_id: contactId || null,
          company_id: companyId || null,
          deal_id: dealId || null,
          currency,
          valid_until: validUntil || null,
          introduction: introduction.trim() || null,
          terms_and_conditions: termsAndConditions.trim() || null,
          customer_note: customerNote.trim() || null,
          internal_note: internalNote.trim() || null,
        });

        // Save line items
        await saveQuoteLineItems(existingQuote.id, lineItems);
      } else {
        // Create new quote
        await createQuote({
          title: title.trim() || undefined,
          contact_id: contactId || undefined,
          company_id: companyId || undefined,
          deal_id: dealId || undefined,
          currency,
          valid_until: validUntil || undefined,
          introduction: introduction.trim() || undefined,
          terms_and_conditions: termsAndConditions.trim() || undefined,
          customer_note: customerNote.trim() || undefined,
          internal_note: internalNote.trim() || undefined,
          line_items: lineItems.map((li) => ({
            product_id: li.product_id || undefined,
            variation_id: li.variation_id || undefined,
            name: li.name,
            description: li.description || undefined,
            sku: li.sku || undefined,
            quantity: li.quantity,
            unit_price: li.unit_price,
            discount_percent: li.discount_percent,
            tax_amount: li.tax_amount,
            sort_order: li.sort_order,
          })),
        });
      }

      onClose();
    } catch (err) {
      console.error('Failed to save quote:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencyOptions = ['USD', 'EUR', 'GBP', 'ZAR', 'AUD', 'CAD', 'JPY'];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">
            {isEditMode ? 'Edit Quote' : 'Create Quote'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quote title"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Contact + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Contact</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">No contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Company</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Deal + Currency + Valid Until */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Deal</label>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">No deal</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Introduction */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Introduction</label>
            <textarea
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              placeholder="Opening message for the client..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Line Items */}
          <LineItemEditor
            items={lineItems}
            onChange={setLineItems}
            currency={currency}
          />

          {/* T&C + Notes */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Terms & Conditions</label>
            <textarea
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Payment terms, conditions..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Customer Note</label>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Visible to customer..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Internal Note</label>
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Internal only..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
              />
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
              disabled={isSubmitting}
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting
                ? 'Saving...'
                : isEditMode
                ? 'Save Changes'
                : 'Create Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
