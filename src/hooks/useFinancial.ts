import { useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import { useFinancialStore } from '../stores/financial';
import type {
  ExpenseCategory,
  BankAccount,
  TaxRate,
  FinancialTransaction,
  Budget,
  FinancialGoal,
  GoalContribution,
  RecurringItem,
  RecurringItemHistory,
} from '../types/financial';

/**
 * Primary data hook for the Financial module.
 * Fetches all entities and subscribes to realtime changes.
 * Follows the same pattern as useCRM / useInvoicing.
 */
export function useFinancial() {
  const store = useFinancialStore();
  const initializedRef = useRef(false);

  // ── Initial fetch ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (initializedRef.current || !isSupabaseConfigured()) return;
    initializedRef.current = true;

    (async () => {
      const [catRes, accRes, taxRes, txnRes, budRes, goalRes, contRes, recRes, recHRes] =
        await Promise.all([
          supabase
            .from('expense_categories')
            .select('*')
            .order('sort_order', { ascending: true }),
          supabase
            .from('bank_accounts')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('tax_rates')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('financial_transactions')
            .select('*')
            .order('transaction_date', { ascending: false })
            .limit(500),
          supabase
            .from('budgets')
            .select('*')
            .order('period_start', { ascending: false }),
          supabase
            .from('financial_goals')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('goal_contributions')
            .select('*')
            .order('contribution_date', { ascending: false }),
          supabase
            .from('recurring_items')
            .select('*')
            .order('next_due_date', { ascending: true }),
          supabase
            .from('recurring_item_history')
            .select('*')
            .order('expected_date', { ascending: false })
            .limit(500),
        ]);

      if (catRes.data) store.setCategories(catRes.data as ExpenseCategory[]);
      if (accRes.data) store.setBankAccounts(accRes.data as BankAccount[]);
      if (taxRes.data) store.setTaxRates(taxRes.data as TaxRate[]);
      if (txnRes.data) store.setTransactions(txnRes.data as FinancialTransaction[]);
      if (budRes.data) store.setBudgets(budRes.data as Budget[]);
      if (goalRes.data) store.setGoals(goalRes.data as FinancialGoal[]);
      if (contRes.data) store.setGoalContributions(contRes.data as GoalContribution[]);
      if (recRes.data) store.setRecurringItems(recRes.data as RecurringItem[]);
      if (recHRes.data) store.setRecurringHistory(recHRes.data as RecurringItemHistory[]);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('financial-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_categories' }, (payload) =>
        handleRealtimePayload<ExpenseCategory>(payload, store.addCategory, store.updateCategory, store.removeCategory)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, (payload) =>
        handleRealtimePayload<BankAccount>(payload, store.addBankAccount, store.updateBankAccount, store.removeBankAccount)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_rates' }, (payload) =>
        handleRealtimePayload<TaxRate>(payload, store.addTaxRate, store.updateTaxRate, store.removeTaxRate)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, (payload) =>
        handleRealtimePayload<FinancialTransaction>(payload, store.addTransaction, store.updateTransaction, store.removeTransaction)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, (payload) =>
        handleRealtimePayload<Budget>(payload, store.addBudget, store.updateBudget, store.removeBudget)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_goals' }, (payload) =>
        handleRealtimePayload<FinancialGoal>(payload, store.addGoal, store.updateGoal, store.removeGoal)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_contributions' }, (payload) =>
        handleRealtimePayload<GoalContribution>(
          payload,
          store.addGoalContribution,
          (_id, _updates) => { /* contributions are immutable, no update handler needed */ },
          store.removeGoalContribution
        )
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_items' }, (payload) =>
        handleRealtimePayload<RecurringItem>(payload, store.addRecurringItem, store.updateRecurringItem, store.removeRecurringItem)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_item_history' }, (payload) =>
        handleRealtimePayload<RecurringItemHistory>(
          payload,
          store.addRecurringHistoryEntry,
          store.updateRecurringHistoryEntry,
          (_id) => { /* history entries are not deleted */ }
        )
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD: Transactions ─────────────────────────────────────────────────────

  const createTransaction = useCallback(
    async (input: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .insert(input)
        .select()
        .single();
      if (error) {
        console.error('[Financial] Error creating transaction:', error);
        return null;
      }
      return data as FinancialTransaction;
    },
    []
  );

  const updateTransaction = useCallback(
    async (id: string, updates: Partial<FinancialTransaction>) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error updating transaction:', error);
        return false;
      }
      store.updateTransaction(id, updates);
      return true;
    },
    [store]
  );

  const voidTransaction = useCallback(
    async (id: string) => {
      return updateTransaction(id, { status: 'void' });
    },
    [updateTransaction]
  );

  // ── CRUD: Bank Accounts ────────────────────────────────────────────────────

  const createBankAccount = useCallback(
    async (input: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert(input)
        .select()
        .single();
      if (error) {
        console.error('[Financial] Error creating bank account:', error);
        return null;
      }
      return data as BankAccount;
    },
    []
  );

  const updateBankAccount = useCallback(
    async (id: string, updates: Partial<BankAccount>) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error updating bank account:', error);
        return false;
      }
      store.updateBankAccount(id, updates);
      return true;
    },
    [store]
  );

  const deleteBankAccount = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error deactivating bank account:', error);
        return false;
      }
      store.removeBankAccount(id);
      return true;
    },
    [store]
  );

  // ── CRUD: Tax Rates ────────────────────────────────────────────────────────

  const createTaxRate = useCallback(
    async (input: Omit<TaxRate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tax_rates')
        .insert(input)
        .select()
        .single();
      if (error) {
        console.error('[Financial] Error creating tax rate:', error);
        return null;
      }
      return data as TaxRate;
    },
    []
  );

  const updateTaxRate = useCallback(
    async (id: string, updates: Partial<TaxRate>) => {
      const { error } = await supabase
        .from('tax_rates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error updating tax rate:', error);
        return false;
      }
      store.updateTaxRate(id, updates);
      return true;
    },
    [store]
  );

  const deleteTaxRate = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('tax_rates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error deactivating tax rate:', error);
        return false;
      }
      store.removeTaxRate(id);
      return true;
    },
    [store]
  );

  // ── CRUD: Budgets ──────────────────────────────────────────────────────────

  const createBudget = useCallback(
    async (input: Omit<Budget, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('budgets')
        .insert(input)
        .select()
        .single();
      if (error) {
        console.error('[Financial] Error creating budget:', error);
        return null;
      }
      return data as Budget;
    },
    []
  );

  const updateBudget = useCallback(
    async (id: string, updates: Partial<Budget>) => {
      const { error } = await supabase
        .from('budgets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error updating budget:', error);
        return false;
      }
      store.updateBudget(id, updates);
      return true;
    },
    [store]
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) {
        console.error('[Financial] Error deleting budget:', error);
        return false;
      }
      store.removeBudget(id);
      return true;
    },
    [store]
  );

  // ── CRUD: Goals ────────────────────────────────────────────────────────────

  const createGoal = useCallback(
    async (input: Omit<FinancialGoal, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('financial_goals')
        .insert(input)
        .select()
        .single();
      if (error) {
        console.error('[Financial] Error creating goal:', error);
        return null;
      }
      return data as FinancialGoal;
    },
    []
  );

  const updateGoal = useCallback(
    async (id: string, updates: Partial<FinancialGoal>) => {
      const { error } = await supabase
        .from('financial_goals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error updating goal:', error);
        return false;
      }
      store.updateGoal(id, updates);
      return true;
    },
    [store]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('financial_goals')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error cancelling goal:', error);
        return false;
      }
      store.updateGoal(id, { status: 'cancelled' });
      return true;
    },
    [store]
  );

  // ── CRUD: Goal Contributions ───────────────────────────────────────────────

  const createGoalContribution = useCallback(
    async (input: Omit<GoalContribution, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('goal_contributions')
        .insert(input)
        .select()
        .single();
      if (error) {
        console.error('[Financial] Error creating goal contribution:', error);
        return null;
      }
      // Also update the goal's current_amount
      const goal = store.goals.find((g) => g.id === input.goal_id);
      if (goal) {
        const newAmount = goal.current_amount + input.amount;
        await supabase
          .from('financial_goals')
          .update({
            current_amount: newAmount,
            status: newAmount >= goal.target_amount ? 'achieved' : 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.goal_id);
        store.updateGoal(input.goal_id, {
          current_amount: newAmount,
          status: newAmount >= goal.target_amount ? 'achieved' : 'active',
        });
      }
      return data as GoalContribution;
    },
    [store]
  );

  const deleteGoalContribution = useCallback(
    async (id: string) => {
      // Find the contribution to subtract amount from goal
      const contribution = store.goalContributions.find((c) => c.id === id);
      const { error } = await supabase.from('goal_contributions').delete().eq('id', id);
      if (error) {
        console.error('[Financial] Error deleting goal contribution:', error);
        return false;
      }
      store.removeGoalContribution(id);
      // Update goal's current_amount
      if (contribution) {
        const goal = store.goals.find((g) => g.id === contribution.goal_id);
        if (goal) {
          const newAmount = Math.max(0, goal.current_amount - contribution.amount);
          await supabase
            .from('financial_goals')
            .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
            .eq('id', contribution.goal_id);
          store.updateGoal(contribution.goal_id, { current_amount: newAmount, status: 'active' });
        }
      }
      return true;
    },
    [store]
  );

  // ── CRUD: Recurring Items ──────────────────────────────────────────────────

  const createRecurringItem = useCallback(
    async (input: Omit<RecurringItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('recurring_items')
        .insert(input)
        .select()
        .single();
      if (error) {
        console.error('[Financial] Error creating recurring item:', error);
        return null;
      }
      return data as RecurringItem;
    },
    []
  );

  const updateRecurringItem = useCallback(
    async (id: string, updates: Partial<RecurringItem>) => {
      const { error } = await supabase
        .from('recurring_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error updating recurring item:', error);
        return false;
      }
      store.updateRecurringItem(id, updates);
      return true;
    },
    [store]
  );

  const deleteRecurringItem = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('recurring_items')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('[Financial] Error deactivating recurring item:', error);
        return false;
      }
      store.updateRecurringItem(id, { is_active: false });
      return true;
    },
    [store]
  );

  // ── Match transaction to recurring item ────────────────────────────────────

  const matchRecurringToTransaction = useCallback(
    async (recurringItemId: string, transactionId: string, historyId?: string) => {
      // Link the transaction
      await supabase
        .from('financial_transactions')
        .update({ recurring_item_id: recurringItemId, updated_at: new Date().toISOString() })
        .eq('id', transactionId);
      store.updateTransaction(transactionId, { recurring_item_id: recurringItemId });

      // Update or create history entry
      const transaction = store.transactions.find((t) => t.id === transactionId);
      if (historyId) {
        await supabase
          .from('recurring_item_history')
          .update({
            transaction_id: transactionId,
            actual_amount: transaction?.amount ?? null,
            status: 'matched',
            variance_pct: transaction
              ? (() => {
                  const history = store.recurringHistory.find((h) => h.id === historyId);
                  if (!history || history.expected_amount === 0) return null;
                  return Math.round(((transaction.amount - history.expected_amount) / history.expected_amount) * 100 * 100) / 100;
                })()
              : null,
          })
          .eq('id', historyId);
      }
      return true;
    },
    [store]
  );

  return {
    // Transactions
    createTransaction,
    updateTransaction,
    voidTransaction,
    // Bank Accounts
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    // Tax Rates
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,
    // Budgets
    createBudget,
    updateBudget,
    deleteBudget,
    // Goals
    createGoal,
    updateGoal,
    deleteGoal,
    // Goal Contributions
    createGoalContribution,
    deleteGoalContribution,
    // Recurring Items
    createRecurringItem,
    updateRecurringItem,
    deleteRecurringItem,
    matchRecurringToTransaction,
  };
}
