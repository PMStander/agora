import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  ExpenseCategory,
  BankAccount,
  TaxRate,
  FinancialTransaction,
  TransactionType,
  TransactionStatus,
  Budget,
  FinancialGoal,
  GoalContribution,
  RecurringItem,
  RecurringItemHistory,
  FinancialContext,
  RecurringItemType,
} from '../types/financial';

// ─── Sub-tab type ────────────────────────────────────────────────────────────

export type FinancialSubTab =
  | 'dashboard' | 'income' | 'expenses' | 'accounts'
  | 'budgets' | 'goals' | 'recurring' | 'forecast' | 'tax';

// ─── Store Interface ─────────────────────────────────────────────────────────

interface FinancialState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  categories: ExpenseCategory[];
  bankAccounts: BankAccount[];
  taxRates: TaxRate[];
  transactions: FinancialTransaction[];
  budgets: Budget[];
  goals: FinancialGoal[];
  goalContributions: GoalContribution[];
  recurringItems: RecurringItem[];
  recurringHistory: RecurringItemHistory[];

  // UI State (persisted)
  selectedTransactionId: string | null;
  selectedAccountId: string | null;
  selectedBudgetPeriod: string | null;
  selectedGoalId: string | null;
  selectedRecurringItemId: string | null;
  activeSubTab: FinancialSubTab;
  financialContext: FinancialContext | 'all';
  forecastMonths: number;
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

  // ─── Budget Actions ────────────────────────────────────────────
  setBudgets: (budgets: Budget[]) => void;
  addBudget: (budget: Budget) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  removeBudget: (id: string) => void;

  // ─── Goal Actions ──────────────────────────────────────────────
  setGoals: (goals: FinancialGoal[]) => void;
  addGoal: (goal: FinancialGoal) => void;
  updateGoal: (id: string, updates: Partial<FinancialGoal>) => void;
  removeGoal: (id: string) => void;

  // ─── Goal Contribution Actions ─────────────────────────────────
  setGoalContributions: (contributions: GoalContribution[]) => void;
  addGoalContribution: (contribution: GoalContribution) => void;
  removeGoalContribution: (id: string) => void;

  // ─── Recurring Item Actions ────────────────────────────────────
  setRecurringItems: (items: RecurringItem[]) => void;
  addRecurringItem: (item: RecurringItem) => void;
  updateRecurringItem: (id: string, updates: Partial<RecurringItem>) => void;
  removeRecurringItem: (id: string) => void;

  // ─── Recurring History Actions ─────────────────────────────────
  setRecurringHistory: (history: RecurringItemHistory[]) => void;
  addRecurringHistoryEntry: (entry: RecurringItemHistory) => void;
  updateRecurringHistoryEntry: (id: string, updates: Partial<RecurringItemHistory>) => void;

  // ─── UI Actions ────────────────────────────────────────────────
  selectTransaction: (id: string | null) => void;
  selectAccount: (id: string | null) => void;
  selectBudgetPeriod: (period: string | null) => void;
  selectGoal: (id: string | null) => void;
  selectRecurringItem: (id: string | null) => void;
  setActiveSubTab: (tab: FinancialSubTab) => void;
  setFinancialContext: (ctx: FinancialContext | 'all') => void;
  setForecastMonths: (months: number) => void;
  setFilters: (filters: Partial<FinancialState['filters']>) => void;
}

// ─── Upsert helper ──────────────────────────────────────────────────────────

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...item };
  return next;
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
      budgets: [],
      goals: [],
      goalContributions: [],
      recurringItems: [],
      recurringHistory: [],

      // UI State
      selectedTransactionId: null,
      selectedAccountId: null,
      selectedBudgetPeriod: null,
      selectedGoalId: null,
      selectedRecurringItemId: null,
      activeSubTab: 'dashboard',
      financialContext: 'all',
      forecastMonths: 6,
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
        set((state) => ({ categories: upsert(state.categories, category) })),
      updateCategory: (id, updates) =>
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
      removeCategory: (id) =>
        set((state) => ({ categories: state.categories.filter((c) => c.id !== id) })),

      // ── Bank Account Actions (upsert pattern) ──
      setBankAccounts: (bankAccounts) => set({ bankAccounts }),
      addBankAccount: (account) =>
        set((state) => ({ bankAccounts: upsert(state.bankAccounts, account) })),
      updateBankAccount: (id, updates) =>
        set((state) => ({
          bankAccounts: state.bankAccounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),
      removeBankAccount: (id) =>
        set((state) => ({
          bankAccounts: state.bankAccounts.filter((a) => a.id !== id),
          selectedAccountId: state.selectedAccountId === id ? null : state.selectedAccountId,
        })),

      // ── Tax Rate Actions (upsert pattern) ──
      setTaxRates: (taxRates) => set({ taxRates }),
      addTaxRate: (rate) =>
        set((state) => ({ taxRates: upsert(state.taxRates, rate) })),
      updateTaxRate: (id, updates) =>
        set((state) => ({
          taxRates: state.taxRates.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      removeTaxRate: (id) =>
        set((state) => ({ taxRates: state.taxRates.filter((r) => r.id !== id) })),

      // ── Transaction Actions (upsert pattern) ──
      setTransactions: (transactions) => set({ transactions }),
      addTransaction: (transaction) =>
        set((state) => ({ transactions: upsert(state.transactions, transaction) })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      removeTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
          selectedTransactionId: state.selectedTransactionId === id ? null : state.selectedTransactionId,
        })),

      // ── Budget Actions (upsert pattern) ──
      setBudgets: (budgets) => set({ budgets }),
      addBudget: (budget) =>
        set((state) => ({ budgets: upsert(state.budgets, budget) })),
      updateBudget: (id, updates) =>
        set((state) => ({
          budgets: state.budgets.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        })),
      removeBudget: (id) =>
        set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) })),

      // ── Goal Actions (upsert pattern) ──
      setGoals: (goals) => set({ goals }),
      addGoal: (goal) =>
        set((state) => ({ goals: upsert(state.goals, goal) })),
      updateGoal: (id, updates) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),
      removeGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
          selectedGoalId: state.selectedGoalId === id ? null : state.selectedGoalId,
        })),

      // ── Goal Contribution Actions ──
      setGoalContributions: (goalContributions) => set({ goalContributions }),
      addGoalContribution: (contribution) =>
        set((state) => ({ goalContributions: upsert(state.goalContributions, contribution) })),
      removeGoalContribution: (id) =>
        set((state) => ({ goalContributions: state.goalContributions.filter((c) => c.id !== id) })),

      // ── Recurring Item Actions (upsert pattern) ──
      setRecurringItems: (recurringItems) => set({ recurringItems }),
      addRecurringItem: (item) =>
        set((state) => ({ recurringItems: upsert(state.recurringItems, item) })),
      updateRecurringItem: (id, updates) =>
        set((state) => ({
          recurringItems: state.recurringItems.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      removeRecurringItem: (id) =>
        set((state) => ({
          recurringItems: state.recurringItems.filter((i) => i.id !== id),
          selectedRecurringItemId: state.selectedRecurringItemId === id ? null : state.selectedRecurringItemId,
        })),

      // ── Recurring History Actions ──
      setRecurringHistory: (recurringHistory) => set({ recurringHistory }),
      addRecurringHistoryEntry: (entry) =>
        set((state) => ({ recurringHistory: upsert(state.recurringHistory, entry) })),
      updateRecurringHistoryEntry: (id, updates) =>
        set((state) => ({
          recurringHistory: state.recurringHistory.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),

      // ── UI Actions ──
      selectTransaction: (id) => set({ selectedTransactionId: id }),
      selectAccount: (id) => set({ selectedAccountId: id }),
      selectBudgetPeriod: (period) => set({ selectedBudgetPeriod: period }),
      selectGoal: (id) => set({ selectedGoalId: id }),
      selectRecurringItem: (id) => set({ selectedRecurringItemId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setFinancialContext: (ctx) => set({ financialContext: ctx }),
      setForecastMonths: (months) => set({ forecastMonths: months }),
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
        selectedBudgetPeriod: state.selectedBudgetPeriod,
        selectedGoalId: state.selectedGoalId,
        selectedRecurringItemId: state.selectedRecurringItemId,
        activeSubTab: state.activeSubTab,
        financialContext: state.financialContext,
        forecastMonths: state.forecastMonths,
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

// Context-aware transaction filter
export const useContextFilteredTransactions = () => {
  const transactions = useFinancialStore((s) => s.transactions);
  const context = useFinancialStore((s) => s.financialContext);
  if (context === 'all') return transactions;
  return transactions.filter((t) => t.context === context);
};

export const useFilteredTransactions = (type?: 'income' | 'expense') => {
  const transactions = useContextFilteredTransactions();
  const filters = useFinancialStore((s) => s.filters);

  return transactions.filter((t) => {
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
  const context = useFinancialStore((s) => s.financialContext);
  return accounts.filter((a) => {
    if (!a.is_active) return false;
    if (context === 'all') return true;
    return a.context === context || a.context === 'both';
  });
};

// ─── New Selectors ──────────────────────────────────────────────────────────

export const useCurrentBudgets = () => {
  const budgets = useFinancialStore((s) => s.budgets);
  const period = useFinancialStore((s) => s.selectedBudgetPeriod);
  const context = useFinancialStore((s) => s.financialContext);
  return budgets.filter((b) => {
    if (period && !b.period_start.startsWith(period)) return false;
    if (context !== 'all' && b.context !== context) return false;
    return true;
  });
};

export const useActiveGoals = () => {
  const goals = useFinancialStore((s) => s.goals);
  const context = useFinancialStore((s) => s.financialContext);
  return goals.filter((g) => {
    if (g.status !== 'active') return false;
    if (context !== 'all' && g.context !== context) return false;
    return true;
  });
};

export const useRecurringByType = (type?: RecurringItemType) => {
  const items = useFinancialStore((s) => s.recurringItems);
  const context = useFinancialStore((s) => s.financialContext);
  return items.filter((i) => {
    if (!i.is_active) return false;
    if (type && i.item_type !== type) return false;
    if (context !== 'all' && i.context !== context) return false;
    return true;
  });
};

export const useSelectedGoal = () => {
  const goals = useFinancialStore((s) => s.goals);
  const selectedId = useFinancialStore((s) => s.selectedGoalId);
  return goals.find((g) => g.id === selectedId) || null;
};

export const useSelectedRecurringItem = () => {
  const items = useFinancialStore((s) => s.recurringItems);
  const selectedId = useFinancialStore((s) => s.selectedRecurringItemId);
  return items.find((i) => i.id === selectedId) || null;
};

// Get default account for a specific context (business or personal)
export const useDefaultAccountForContext = (context: FinancialContext) => {
  const accounts = useFinancialStore((s) => s.bankAccounts);
  return accounts.find(
    (a) => a.is_active && a.is_default && (a.context === context || a.context === 'both')
  ) || null;
};

// Get all active bank accounts regardless of context filter (for use in forms)
export const useAllActiveBankAccounts = () => {
  const accounts = useFinancialStore((s) => s.bankAccounts);
  return accounts.filter((a) => a.is_active);
};
