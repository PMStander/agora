import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ExpenseCategory,
  BankAccount,
  TaxRate,
  FinancialTransaction,
  TransactionType,
  TransactionStatus,
} from '../types/financial';

// ─── Sub-tab type ────────────────────────────────────────────────────────────

export type FinancialSubTab = 'dashboard' | 'income' | 'expenses' | 'accounts' | 'tax';

// ─── Store Interface ─────────────────────────────────────────────────────────

interface FinancialState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  categories: ExpenseCategory[];
  bankAccounts: BankAccount[];
  taxRates: TaxRate[];
  transactions: FinancialTransaction[];

  // UI State (persisted)
  selectedTransactionId: string | null;
  selectedAccountId: string | null;
  activeSubTab: FinancialSubTab;
  filters: {
    transactionType: TransactionType | 'all';
    transactionStatus: TransactionStatus | 'all';
    categoryId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };

  // ─── Category Actions ──────────────────────────────────────────
  setCategories: (categories: ExpenseCategory[]) => void;
  addCategory: (category: ExpenseCategory) => void;
  updateCategory: (id: string, updates: Partial<ExpenseCategory>) => void;
  removeCategory: (id: string) => void;

  // ─── Bank Account Actions ──────────────────────────────────────
  setBankAccounts: (accounts: BankAccount[]) => void;
  addBankAccount: (account: BankAccount) => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  removeBankAccount: (id: string) => void;

  // ─── Tax Rate Actions ──────────────────────────────────────────
  setTaxRates: (rates: TaxRate[]) => void;
  addTaxRate: (rate: TaxRate) => void;
  updateTaxRate: (id: string, updates: Partial<TaxRate>) => void;
  removeTaxRate: (id: string) => void;

  // ─── Transaction Actions ───────────────────────────────────────
  setTransactions: (transactions: FinancialTransaction[]) => void;
  addTransaction: (transaction: FinancialTransaction) => void;
  updateTransaction: (id: string, updates: Partial<FinancialTransaction>) => void;
  removeTransaction: (id: string) => void;

  // ─── UI Actions ────────────────────────────────────────────────
  selectTransaction: (id: string | null) => void;
  selectAccount: (id: string | null) => void;
  setActiveSubTab: (tab: FinancialSubTab) => void;
  setFilters: (filters: Partial<FinancialState['filters']>) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const FINANCIAL_STORAGE_KEY = 'agora-financial-v1';

export const useFinancialStore = create<FinancialState>()(
  persist(
    (set) => ({
      // Initial data
      categories: [],
      bankAccounts: [],
      taxRates: [],
      transactions: [],

      // UI State
      selectedTransactionId: null,
      selectedAccountId: null,
      activeSubTab: 'dashboard',
      filters: {
        transactionType: 'all',
        transactionStatus: 'all',
        categoryId: null,
        dateFrom: null,
        dateTo: null,
      },

      // ── Category Actions (upsert pattern) ──
      setCategories: (categories) => set({ categories }),
      addCategory: (category) =>
        set((state) => {
          const idx = state.categories.findIndex((c) => c.id === category.id);
          if (idx === -1) return { categories: [category, ...state.categories] };
          const categories = [...state.categories];
          categories[idx] = { ...categories[idx], ...category };
          return { categories };
        }),
      updateCategory: (id, updates) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        })),

      // ── Bank Account Actions (upsert pattern) ──
      setBankAccounts: (bankAccounts) => set({ bankAccounts }),
      addBankAccount: (account) =>
        set((state) => {
          const idx = state.bankAccounts.findIndex((a) => a.id === account.id);
          if (idx === -1) return { bankAccounts: [account, ...state.bankAccounts] };
          const bankAccounts = [...state.bankAccounts];
          bankAccounts[idx] = { ...bankAccounts[idx], ...account };
          return { bankAccounts };
        }),
      updateBankAccount: (id, updates) =>
        set((state) => ({
          bankAccounts: state.bankAccounts.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),
      removeBankAccount: (id) =>
        set((state) => ({
          bankAccounts: state.bankAccounts.filter((a) => a.id !== id),
          selectedAccountId:
            state.selectedAccountId === id ? null : state.selectedAccountId,
        })),

      // ── Tax Rate Actions (upsert pattern) ──
      setTaxRates: (taxRates) => set({ taxRates }),
      addTaxRate: (rate) =>
        set((state) => {
          const idx = state.taxRates.findIndex((r) => r.id === rate.id);
          if (idx === -1) return { taxRates: [rate, ...state.taxRates] };
          const taxRates = [...state.taxRates];
          taxRates[idx] = { ...taxRates[idx], ...rate };
          return { taxRates };
        }),
      updateTaxRate: (id, updates) =>
        set((state) => ({
          taxRates: state.taxRates.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      removeTaxRate: (id) =>
        set((state) => ({
          taxRates: state.taxRates.filter((r) => r.id !== id),
        })),

      // ── Transaction Actions (upsert pattern) ──
      setTransactions: (transactions) => set({ transactions }),
      addTransaction: (transaction) =>
        set((state) => {
          const idx = state.transactions.findIndex((t) => t.id === transaction.id);
          if (idx === -1) return { transactions: [transaction, ...state.transactions] };
          const transactions = [...state.transactions];
          transactions[idx] = { ...transactions[idx], ...transaction };
          return { transactions };
        }),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      removeTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
          selectedTransactionId:
            state.selectedTransactionId === id ? null : state.selectedTransactionId,
        })),

      // ── UI Actions ──
      selectTransaction: (id) => set({ selectedTransactionId: id }),
      selectAccount: (id) => set({ selectedAccountId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
    }),
    {
      name: FINANCIAL_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state, NOT entity data
      partialize: (state) => ({
        selectedTransactionId: state.selectedTransactionId,
        selectedAccountId: state.selectedAccountId,
        activeSubTab: state.activeSubTab,
        filters: state.filters,
      }),
    }
  )
);

// ─── Selectors ───────────────────────────────────────────────────────────────

export const useSelectedTransaction = () => {
  const transactions = useFinancialStore((s) => s.transactions);
  const selectedId = useFinancialStore((s) => s.selectedTransactionId);
  return transactions.find((t) => t.id === selectedId) || null;
};

export const useSelectedBankAccount = () => {
  const accounts = useFinancialStore((s) => s.bankAccounts);
  const selectedId = useFinancialStore((s) => s.selectedAccountId);
  return accounts.find((a) => a.id === selectedId) || null;
};

export const useFilteredTransactions = (type?: 'income' | 'expense') => {
  const transactions = useFinancialStore((s) => s.transactions);
  const filters = useFinancialStore((s) => s.filters);

  return transactions.filter((t) => {
    // Type filter (from parameter OR from filters)
    if (type && t.transaction_type !== type) return false;
    if (!type && filters.transactionType !== 'all' && t.transaction_type !== filters.transactionType)
      return false;
    if (filters.transactionStatus !== 'all' && t.status !== filters.transactionStatus)
      return false;
    if (filters.categoryId && t.category_id !== filters.categoryId)
      return false;
    if (filters.dateFrom && t.transaction_date < filters.dateFrom)
      return false;
    if (filters.dateTo && t.transaction_date > filters.dateTo)
      return false;
    return true;
  });
};

export const useIncomeTransactions = () => useFilteredTransactions('income');
export const useExpenseTransactions = () => useFilteredTransactions('expense');

export const useActiveCategories = (type?: 'income' | 'expense') => {
  const categories = useFinancialStore((s) => s.categories);
  return categories
    .filter((c) => !type || c.type === type || c.type === 'both')
    .sort((a, b) => a.sort_order - b.sort_order);
};

export const useActiveTaxRates = () => {
  const taxRates = useFinancialStore((s) => s.taxRates);
  return taxRates.filter((r) => r.is_active);
};

export const useActiveBankAccounts = () => {
  const accounts = useFinancialStore((s) => s.bankAccounts);
  return accounts.filter((a) => a.is_active);
};
