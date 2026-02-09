import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useInvoicingStore } from '../stores/invoicing';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import type {
  Quote,
  QuoteLineItem,
  Invoice,
  InvoiceLineItem,
  InvoicePayment,
  QuoteStatus,
  InvoiceStatus,
} from '../types/invoicing';
import { createNotificationDirect } from './useNotifications';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useInvoicing() {
  const store = useInvoicingStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch quotes
    supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setQuotes(data as Quote[]);
      });

    // Fetch invoices
    supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setInvoices(data as Invoice[]);
      });

    // ── Realtime subscriptions ──
    const quotesSub = supabase
      .channel('invoicing-quotes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes' },
        (payload) =>
          handleRealtimePayload<Quote>(
            payload,
            store.addQuote,
            store.updateQuote,
            store.removeQuote
          )
      )
      .subscribe();

    const invoicesSub = supabase
      .channel('invoicing-invoices-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        (payload) =>
          handleRealtimePayload<Invoice>(
            payload,
            store.addInvoice,
            store.updateInvoice,
            store.removeInvoice
          )
      )
      .subscribe();

    return () => {
      quotesSub.unsubscribe();
      invoicesSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-number generation ──

  const getNextQuoteNumber = useCallback(async (): Promise<string> => {
    const { data } = await supabase
      .from('quotes')
      .select('quote_number')
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const match = data[0].quote_number.match(/Q-(\d+)/);
      if (match) {
        return `Q-${String(parseInt(match[1], 10) + 1).padStart(5, '0')}`;
      }
    }
    return 'Q-00001';
  }, []);

  const getNextInvoiceNumber = useCallback(async (): Promise<string> => {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const match = data[0].invoice_number.match(/INV-(\d+)/);
      if (match) {
        return `INV-${String(parseInt(match[1], 10) + 1).padStart(5, '0')}`;
      }
    }
    return 'INV-00001';
  }, []);

  // ── Quote CRUD ──

  const createQuote = useCallback(
    async (data: {
      title?: string;
      contact_id?: string;
      company_id?: string;
      deal_id?: string;
      project_id?: string;
      currency?: string;
      valid_until?: string;
      introduction?: string;
      terms_and_conditions?: string;
      customer_note?: string;
      internal_note?: string;
      owner_agent_id?: string;
      line_items?: Array<{
        product_id?: string;
        variation_id?: string;
        name: string;
        description?: string;
        sku?: string;
        quantity: number;
        unit_price: number;
        discount_percent?: number;
        tax_amount?: number;
        sort_order?: number;
      }>;
    }) => {
      const { line_items, ...quoteData } = data;
      const quote_number = await getNextQuoteNumber();

      const { data: quote, error } = await supabase
        .from('quotes')
        .insert({ ...quoteData, quote_number })
        .select()
        .single();
      if (error) {
        console.error('[Invoicing] Error creating quote:', error);
        return null;
      }

      // Insert line items if provided
      if (line_items?.length) {
        const items = line_items.map((li, idx) => ({
          quote_id: quote.id,
          product_id: li.product_id || null,
          variation_id: li.variation_id || null,
          name: li.name,
          description: li.description || null,
          sku: li.sku || null,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent || 0,
          tax_amount: li.tax_amount || 0,
          sort_order: li.sort_order ?? idx,
        }));

        await supabase.from('quote_line_items').insert(items);

        // Recalculate totals
        const subtotal = items.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (1 - li.discount_percent / 100),
          0
        );
        const tax_total = items.reduce((sum, li) => sum + li.tax_amount, 0);
        const discount_total = items.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (li.discount_percent / 100),
          0
        );
        const total = subtotal + tax_total;

        await supabase
          .from('quotes')
          .update({ subtotal, tax_total, discount_total, total })
          .eq('id', quote.id);

        quote.subtotal = subtotal;
        quote.tax_total = tax_total;
        quote.discount_total = discount_total;
        quote.total = total;
      }

      store.addQuote(quote as Quote);
      return quote as Quote;
    },
    [store, getNextQuoteNumber]
  );

  const updateQuoteDetails = useCallback(
    async (quoteId: string, updates: Partial<Quote>) => {
      const { error } = await supabase
        .from('quotes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', quoteId);
      if (error) {
        console.error('[Invoicing] Error updating quote:', error);
        return;
      }
      store.updateQuote(quoteId, updates);
    },
    [store]
  );

  const updateQuoteStatus = useCallback(
    async (quoteId: string, status: QuoteStatus) => {
      const updates: Partial<Quote> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'accepted') updates.accepted_at = new Date().toISOString();
      if (status === 'declined') updates.declined_at = new Date().toISOString();

      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', quoteId);
      if (error) {
        console.error('[Invoicing] Error updating quote status:', error);
        return;
      }
      store.updateQuote(quoteId, updates);

      // Create notifications for quote acceptance/decline
      const quote = store.quotes.find((q) => q.id === quoteId);
      const quoteLabel = quote?.quote_number || quoteId;
      if (status === 'accepted') {
        createNotificationDirect(
          'quote_accepted',
          `Quote ${quoteLabel} accepted`,
          quote?.title || undefined,
          'quote',
          quoteId
        );
      } else if (status === 'declined') {
        createNotificationDirect(
          'quote_declined',
          `Quote ${quoteLabel} declined`,
          quote?.title || undefined,
          'quote',
          quoteId
        );
      }
    },
    [store]
  );

  const deleteQuote = useCallback(
    async (quoteId: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);
      if (error) {
        console.error('[Invoicing] Error deleting quote:', error);
        return;
      }
      store.removeQuote(quoteId);
    },
    [store]
  );

  // ── Quote line items ──

  const fetchQuoteLineItems = useCallback(
    async (quoteId: string): Promise<QuoteLineItem[]> => {
      const { data, error } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order');
      if (error) {
        console.error('[Invoicing] Error fetching quote line items:', error);
        return [];
      }
      return data as QuoteLineItem[];
    },
    []
  );

  const saveQuoteLineItems = useCallback(
    async (
      quoteId: string,
      items: Array<{
        id?: string;
        product_id?: string | null;
        variation_id?: string | null;
        name: string;
        description?: string | null;
        sku?: string | null;
        quantity: number;
        unit_price: number;
        discount_percent?: number;
        tax_amount?: number;
        sort_order?: number;
      }>
    ) => {
      // Delete existing and re-insert
      await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);

      if (items.length > 0) {
        const rows = items.map((li, idx) => ({
          quote_id: quoteId,
          product_id: li.product_id || null,
          variation_id: li.variation_id || null,
          name: li.name,
          description: li.description || null,
          sku: li.sku || null,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent || 0,
          tax_amount: li.tax_amount || 0,
          sort_order: li.sort_order ?? idx,
        }));

        await supabase.from('quote_line_items').insert(rows);

        // Recalculate totals
        const subtotal = rows.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (1 - li.discount_percent / 100),
          0
        );
        const tax_total = rows.reduce((sum, li) => sum + li.tax_amount, 0);
        const discount_total = rows.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (li.discount_percent / 100),
          0
        );
        const total = subtotal + tax_total;

        await supabase
          .from('quotes')
          .update({ subtotal, tax_total, discount_total, total, updated_at: new Date().toISOString() })
          .eq('id', quoteId);

        store.updateQuote(quoteId, { subtotal, tax_total, discount_total, total });
      } else {
        await supabase
          .from('quotes')
          .update({ subtotal: 0, tax_total: 0, discount_total: 0, total: 0, updated_at: new Date().toISOString() })
          .eq('id', quoteId);
        store.updateQuote(quoteId, { subtotal: 0, tax_total: 0, discount_total: 0, total: 0 });
      }
    },
    [store]
  );

  // ── Invoice CRUD ──

  const createInvoice = useCallback(
    async (data: {
      contact_id?: string;
      company_id?: string;
      deal_id?: string;
      project_id?: string;
      order_id?: string;
      quote_id?: string;
      currency?: string;
      due_date?: string;
      is_recurring?: boolean;
      recurring_interval?: string;
      billing_address?: Record<string, unknown>;
      terms_and_conditions?: string;
      customer_note?: string;
      internal_note?: string;
      owner_agent_id?: string;
      line_items?: Array<{
        product_id?: string;
        variation_id?: string;
        name: string;
        description?: string;
        sku?: string;
        quantity: number;
        unit_price: number;
        discount_percent?: number;
        tax_amount?: number;
        sort_order?: number;
      }>;
    }) => {
      const { line_items, ...invoiceData } = data;
      const invoice_number = await getNextInvoiceNumber();

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({ ...invoiceData, invoice_number })
        .select()
        .single();
      if (error) {
        console.error('[Invoicing] Error creating invoice:', error);
        return null;
      }

      if (line_items?.length) {
        const items = line_items.map((li, idx) => ({
          invoice_id: invoice.id,
          product_id: li.product_id || null,
          variation_id: li.variation_id || null,
          name: li.name,
          description: li.description || null,
          sku: li.sku || null,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent || 0,
          tax_amount: li.tax_amount || 0,
          sort_order: li.sort_order ?? idx,
        }));

        await supabase.from('invoice_line_items').insert(items);

        const subtotal = items.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (1 - li.discount_percent / 100),
          0
        );
        const tax_total = items.reduce((sum, li) => sum + li.tax_amount, 0);
        const discount_total = items.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (li.discount_percent / 100),
          0
        );
        const total = subtotal + tax_total;

        await supabase
          .from('invoices')
          .update({ subtotal, tax_total, discount_total, total })
          .eq('id', invoice.id);

        invoice.subtotal = subtotal;
        invoice.tax_total = tax_total;
        invoice.discount_total = discount_total;
        invoice.total = total;
      }

      store.addInvoice(invoice as Invoice);
      return invoice as Invoice;
    },
    [store, getNextInvoiceNumber]
  );

  const updateInvoiceDetails = useCallback(
    async (invoiceId: string, updates: Partial<Invoice>) => {
      const { error } = await supabase
        .from('invoices')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);
      if (error) {
        console.error('[Invoicing] Error updating invoice:', error);
        return;
      }
      store.updateInvoice(invoiceId, updates);
    },
    [store]
  );

  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: InvoiceStatus) => {
      const updates: Partial<Invoice> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'paid') updates.paid_at = new Date().toISOString();

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);
      if (error) {
        console.error('[Invoicing] Error updating invoice status:', error);
        return;
      }
      store.updateInvoice(invoiceId, updates);

      // Create notifications for invoice status changes
      const invoice = store.invoices.find((i) => i.id === invoiceId);
      const invoiceLabel = invoice?.invoice_number || invoiceId;
      if (status === 'paid') {
        createNotificationDirect(
          'invoice_paid',
          `Invoice ${invoiceLabel} paid`,
          invoice ? `${invoice.currency} ${invoice.total.toFixed(2)}` : undefined,
          'invoice',
          invoiceId
        );
      } else if (status === 'overdue') {
        createNotificationDirect(
          'invoice_overdue',
          `Invoice ${invoiceLabel} is overdue`,
          invoice ? `${invoice.currency} ${invoice.total.toFixed(2)} due` : undefined,
          'invoice',
          invoiceId
        );
      }
    },
    [store]
  );

  const deleteInvoice = useCallback(
    async (invoiceId: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) {
        console.error('[Invoicing] Error deleting invoice:', error);
        return;
      }
      store.removeInvoice(invoiceId);
    },
    [store]
  );

  // ── Invoice line items ──

  const fetchInvoiceLineItems = useCallback(
    async (invoiceId: string): Promise<InvoiceLineItem[]> => {
      const { data, error } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sort_order');
      if (error) {
        console.error('[Invoicing] Error fetching invoice line items:', error);
        return [];
      }
      return data as InvoiceLineItem[];
    },
    []
  );

  const saveInvoiceLineItems = useCallback(
    async (
      invoiceId: string,
      items: Array<{
        id?: string;
        product_id?: string | null;
        variation_id?: string | null;
        name: string;
        description?: string | null;
        sku?: string | null;
        quantity: number;
        unit_price: number;
        discount_percent?: number;
        tax_amount?: number;
        sort_order?: number;
      }>
    ) => {
      await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);

      if (items.length > 0) {
        const rows = items.map((li, idx) => ({
          invoice_id: invoiceId,
          product_id: li.product_id || null,
          variation_id: li.variation_id || null,
          name: li.name,
          description: li.description || null,
          sku: li.sku || null,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent || 0,
          tax_amount: li.tax_amount || 0,
          sort_order: li.sort_order ?? idx,
        }));

        await supabase.from('invoice_line_items').insert(rows);

        const subtotal = rows.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (1 - li.discount_percent / 100),
          0
        );
        const tax_total = rows.reduce((sum, li) => sum + li.tax_amount, 0);
        const discount_total = rows.reduce(
          (sum, li) => sum + li.quantity * li.unit_price * (li.discount_percent / 100),
          0
        );
        const total = subtotal + tax_total;

        await supabase
          .from('invoices')
          .update({ subtotal, tax_total, discount_total, total, updated_at: new Date().toISOString() })
          .eq('id', invoiceId);

        store.updateInvoice(invoiceId, { subtotal, tax_total, discount_total, total });
      } else {
        await supabase
          .from('invoices')
          .update({ subtotal: 0, tax_total: 0, discount_total: 0, total: 0, updated_at: new Date().toISOString() })
          .eq('id', invoiceId);
        store.updateInvoice(invoiceId, { subtotal: 0, tax_total: 0, discount_total: 0, total: 0 });
      }
    },
    [store]
  );

  // ── Payments ──

  const fetchInvoicePayments = useCallback(
    async (invoiceId: string): Promise<InvoicePayment[]> => {
      const { data, error } = await supabase
        .from('invoice_payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('paid_at', { ascending: false });
      if (error) {
        console.error('[Invoicing] Error fetching payments:', error);
        return [];
      }
      return data as InvoicePayment[];
    },
    []
  );

  const recordPayment = useCallback(
    async (
      invoiceId: string,
      amount: number,
      payment_method?: string,
      reference_number?: string,
      notes?: string
    ) => {
      const { data: payment, error } = await supabase
        .from('invoice_payments')
        .insert({
          invoice_id: invoiceId,
          amount,
          payment_method: payment_method || null,
          reference_number: reference_number || null,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) {
        console.error('[Invoicing] Error recording payment:', error);
        return null;
      }

      // Update amount_paid on invoice
      const invoice = store.invoices.find((i) => i.id === invoiceId);
      if (invoice) {
        const newAmountPaid = invoice.amount_paid + amount;
        const newStatus: InvoiceStatus =
          newAmountPaid >= invoice.total ? 'paid' : 'partially_paid';
        const updates: Partial<Invoice> = {
          amount_paid: newAmountPaid,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (newStatus === 'paid') updates.paid_at = new Date().toISOString();

        await supabase.from('invoices').update(updates).eq('id', invoiceId);
        store.updateInvoice(invoiceId, updates);

        // Notify when invoice becomes fully paid via payment recording
        if (newStatus === 'paid') {
          createNotificationDirect(
            'invoice_paid',
            `Invoice ${invoice.invoice_number} paid in full`,
            `${invoice.currency} ${invoice.total.toFixed(2)}`,
            'invoice',
            invoiceId
          );
        }
      }

      return payment as InvoicePayment;
    },
    [store]
  );

  // ── Conversion functions ──

  const convertQuoteToInvoice = useCallback(
    async (quoteId: string) => {
      const quote = store.quotes.find((q) => q.id === quoteId);
      if (!quote) return null;

      // Fetch quote line items
      const lineItems = await fetchQuoteLineItems(quoteId);

      // Create invoice with same data
      const invoice = await createInvoice({
        contact_id: quote.contact_id || undefined,
        company_id: quote.company_id || undefined,
        deal_id: quote.deal_id || undefined,
        project_id: quote.project_id || undefined,
        quote_id: quoteId,
        currency: quote.currency,
        terms_and_conditions: quote.terms_and_conditions || undefined,
        customer_note: quote.customer_note || undefined,
        internal_note: quote.internal_note || undefined,
        owner_agent_id: quote.owner_agent_id || undefined,
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

      if (invoice) {
        // Mark quote as converted
        await updateQuoteDetails(quoteId, {
          status: 'converted',
          converted_to_invoice_id: invoice.id,
          converted_at: new Date().toISOString(),
        });
      }

      return invoice;
    },
    [store, fetchQuoteLineItems, createInvoice, updateQuoteDetails]
  );

  const createInvoiceFromDeal = useCallback(
    async (dealId: string) => {
      // Import from CRM store at call time to avoid circular deps
      const { useCrmStore } = await import('../stores/crm');
      const deal = useCrmStore.getState().deals.find((d) => d.id === dealId);
      if (!deal) return null;

      return createInvoice({
        contact_id: deal.contact_id || undefined,
        company_id: deal.company_id || undefined,
        deal_id: dealId,
        currency: deal.currency,
      });
    },
    [createInvoice]
  );

  return {
    // Data
    quotes: store.quotes,
    invoices: store.invoices,

    // Quote
    createQuote,
    updateQuoteDetails,
    updateQuoteStatus,
    deleteQuote,
    fetchQuoteLineItems,
    saveQuoteLineItems,

    // Invoice
    createInvoice,
    updateInvoiceDetails,
    updateInvoiceStatus,
    deleteInvoice,
    fetchInvoiceLineItems,
    saveInvoiceLineItems,

    // Payments
    fetchInvoicePayments,
    recordPayment,

    // Conversion
    convertQuoteToInvoice,
    createInvoiceFromDeal,

    // Numbering
    getNextQuoteNumber,
    getNextInvoiceNumber,

    // State
    isConfigured: isSupabaseConfigured(),
  };
}
