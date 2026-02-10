import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  ProfitLossRow,
  ExpenseByCategoryRow,
  ReceivablesAgingRow,
  CashFlowRow,
  TaxSummaryRow,
} from '../types/financial';

/**
 * Hook for fetching financial report data from the 5 SQL views.
 * Each view is fetched independently so dashboard can show partial results.
 */
export function useFinancialReports(currency?: string) {
  const [profitLoss, setProfitLoss] = useState<ProfitLossRow[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategoryRow[]>([]);
  const [receivablesAging, setReceivablesAging] = useState<ReceivablesAgingRow[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowRow[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [plRes, ecRes, arRes, cfRes, tsRes] = await Promise.all([
        (() => {
          let q = supabase.from('v_profit_loss').select('*').order('month', { ascending: false }).limit(12);
          if (currency) q = q.eq('currency', currency);
          return q;
        })(),
        (() => {
          let q = supabase.from('v_expense_by_category').select('*').order('month', { ascending: false }).limit(50);
          if (currency) q = q.eq('currency', currency);
          return q;
        })(),
        (() => {
          let q = supabase.from('v_receivables_aging').select('*');
          if (currency) q = q.eq('currency', currency);
          return q;
        })(),
        (() => {
          let q = supabase.from('v_cash_flow').select('*').order('month', { ascending: false }).limit(12);
          if (currency) q = q.eq('currency', currency);
          return q;
        })(),
        (() => {
          let q = supabase.from('v_tax_summary').select('*').order('month', { ascending: false }).limit(12);
          if (currency) q = q.eq('currency', currency);
          return q;
        })(),
      ]);

      if (plRes.data) setProfitLoss(plRes.data as ProfitLossRow[]);
      if (ecRes.data) setExpensesByCategory(ecRes.data as ExpenseByCategoryRow[]);
      if (arRes.data) setReceivablesAging(arRes.data as ReceivablesAgingRow[]);
      if (cfRes.data) setCashFlow(cfRes.data as CashFlowRow[]);
      if (tsRes.data) setTaxSummary(tsRes.data as TaxSummaryRow[]);
    } catch (err) {
      console.error('[FinancialReports] Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    profitLoss,
    expensesByCategory,
    receivablesAging,
    cashFlow,
    taxSummary,
    loading,
    refresh: fetchReports,
  };
}
