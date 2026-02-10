import { useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import { useFinancialStore } from '../stores/financial';
import type {
  ExpenseCategory,
  BankAccount,
  TaxRate,
  FinancialTransaction,
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
      const [catRes, accRes, taxRes, txnRes] = await Promise.all([
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
      ]);

      if (catRes.data) store.setCategories(catRes.data as ExpenseCategory[]);
      if (accRes.data) store.setBankAccounts(accRes.data as BankAccount[]);
      if (taxRes.data) store.setTaxRates(taxRes.data as TaxRate[]);
      if (txnRes.data) store.setTransactions(txnRes.data as FinancialTransaction[]);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('financial-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_categories' }, (payload) =>
        handleRealtimePayload<ExpenseCategory>(
          payload,
          store.addCategory,
          store.updateCategory,
          store.removeCategory
        )
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, (payload) =>
        handleRealtimePayload<BankAccount>(
          payload,
          store.addBankAccount,
          store.updateBankAccount,
          store.removeBankAccount
        )
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tax_rates' }, (payload) =>
        handleRealtimePayload<TaxRate>(
          payload,
          store.addTaxRate,
          store.updateTaxRate,
          store.removeTaxRate
        )
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, (payload) =>
        handleRealtimePayload<FinancialTransaction>(
          payload,
          store.addTransaction,
          store.updateTransaction,
          store.removeTransaction
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
  };
}
