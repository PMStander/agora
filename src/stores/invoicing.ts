import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Quote,
  Invoice,
  QuoteStatus,
  InvoiceStatus,
} from '../types/invoicing';

// ─── Store Interface ────────────────────────────────────────────────────────

interface InvoicingState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  quotes: Quote[];
  invoices: Invoice[];

  // UI State (persisted)
  selectedQuoteId: string | null;
  selectedInvoiceId: string | null;
  activeSubTab: 'quotes' | 'invoices';
  filters: {
    quoteStatus: QuoteStatus | 'all';
    invoiceStatus: InvoiceStatus | 'all';
  };

  // ─── Quote Actions ──────────────────────────────────────────
  setQuotes: (quotes: Quote[]) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (quoteId: string, updates: Partial<Quote>) => void;
  removeQuote: (quoteId: string) => void;

  // ─── Invoice Actions ────────────────────────────────────────
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  removeInvoice: (invoiceId: string) => void;

  // ─── UI Actions ─────────────────────────────────────────────
  selectQuote: (id: string | null) => void;
  selectInvoice: (id: string | null) => void;
  setActiveSubTab: (tab: InvoicingState['activeSubTab']) => void;
  setFilters: (filters: Partial<InvoicingState['filters']>) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const INVOICING_STORAGE_KEY = 'agora-invoicing-v1';

export const useInvoicingStore = create<InvoicingState>()(
  persist(
    (set) => ({
      // Initial data
      quotes: [],
      invoices: [],

      // UI State
      selectedQuoteId: null,
      selectedInvoiceId: null,
      activeSubTab: 'quotes',
      filters: {
        quoteStatus: 'all',
        invoiceStatus: 'all',
      },

      // Quote Actions (upsert pattern)
      setQuotes: (quotes) => set({ quotes }),
      addQuote: (quote) =>
        set((state) => {
          const idx = state.quotes.findIndex((q) => q.id === quote.id);
          if (idx === -1) return { quotes: [quote, ...state.quotes] };
          const quotes = [...state.quotes];
          quotes[idx] = { ...quotes[idx], ...quote };
          return { quotes };
        }),
      updateQuote: (quoteId, updates) =>
        set((state) => ({
          quotes: state.quotes.map((q) =>
            q.id === quoteId ? { ...q, ...updates } : q
          ),
        })),
      removeQuote: (quoteId) =>
        set((state) => ({
          quotes: state.quotes.filter((q) => q.id !== quoteId),
          selectedQuoteId:
            state.selectedQuoteId === quoteId ? null : state.selectedQuoteId,
        })),

      // Invoice Actions (upsert pattern)
      setInvoices: (invoices) => set({ invoices }),
      addInvoice: (invoice) =>
        set((state) => {
          const idx = state.invoices.findIndex((i) => i.id === invoice.id);
          if (idx === -1) return { invoices: [invoice, ...state.invoices] };
          const invoices = [...state.invoices];
          invoices[idx] = { ...invoices[idx], ...invoice };
          return { invoices };
        }),
      updateInvoice: (invoiceId, updates) =>
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === invoiceId ? { ...i, ...updates } : i
          ),
        })),
      removeInvoice: (invoiceId) =>
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== invoiceId),
          selectedInvoiceId:
            state.selectedInvoiceId === invoiceId ? null : state.selectedInvoiceId,
        })),

      // UI Actions
      selectQuote: (id) => set({ selectedQuoteId: id }),
      selectInvoice: (id) => set({ selectedInvoiceId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
    }),
    {
      name: INVOICING_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state, NOT entity data
      partialize: (state) => ({
        selectedQuoteId: state.selectedQuoteId,
        selectedInvoiceId: state.selectedInvoiceId,
        activeSubTab: state.activeSubTab,
        filters: state.filters,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedQuote = () => {
  const quotes = useInvoicingStore((s) => s.quotes);
  const selectedId = useInvoicingStore((s) => s.selectedQuoteId);
  return quotes.find((q) => q.id === selectedId) || null;
};

export const useSelectedInvoice = () => {
  const invoices = useInvoicingStore((s) => s.invoices);
  const selectedId = useInvoicingStore((s) => s.selectedInvoiceId);
  return invoices.find((i) => i.id === selectedId) || null;
};

export const useFilteredQuotes = () => {
  const quotes = useInvoicingStore((s) => s.quotes);
  const filters = useInvoicingStore((s) => s.filters);

  return quotes.filter((quote) => {
    if (filters.quoteStatus !== 'all' && quote.status !== filters.quoteStatus)
      return false;
    return true;
  });
};

export const useFilteredInvoices = () => {
  const invoices = useInvoicingStore((s) => s.invoices);
  const filters = useInvoicingStore((s) => s.filters);

  return invoices.filter((invoice) => {
    if (filters.invoiceStatus !== 'all' && invoice.status !== filters.invoiceStatus)
      return false;
    return true;
  });
};

export const useQuotesForDeal = (dealId: string | null) => {
  const quotes = useInvoicingStore((s) => s.quotes);
  if (!dealId) return [];
  return quotes.filter((q) => q.deal_id === dealId);
};

export const useInvoicesForDeal = (dealId: string | null) => {
  const invoices = useInvoicingStore((s) => s.invoices);
  if (!dealId) return [];
  return invoices.filter((i) => i.deal_id === dealId);
};
