import { useMemo, useCallback } from 'react';
import { useFinancialStore, useCurrentBudgets } from '../stores/financial';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createNotificationDirect } from './useNotifications';
import type { Budget } from '../types/financial';

// ─── Budget vs Actual (client-side computed) ──────────────────────────────────

interface BudgetActual {
  budget: Budget;
  categoryName: string | null;
  categoryColor: string | null;
  spent: number;
  effective: number;
  utilization: number;
  variance: number;
}

export function useBudgetTracking() {
  const budgets = useCurrentBudgets();
  const transactions = useFinancialStore((s) => s.transactions);
  const categories = useFinancialStore((s) => s.categories);
  const financialContext = useFinancialStore((s) => s.financialContext);

  // Compute actual spent per budget
  const budgetActuals: BudgetActual[] = useMemo(() => {
    return budgets.map((b) => {
      const periodEnd = getPeriodEnd(b.period_start, b.period_type);
      const cat = categories.find((c) => c.id === b.category_id);

      const spent = transactions
        .filter(
          (t) =>
            t.transaction_type === 'expense' &&
            t.status !== 'void' &&
            t.category_id === b.category_id &&
            t.transaction_date >= b.period_start &&
            t.transaction_date < periodEnd
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const effective = b.amount + b.rollover_amount;
      const utilization = effective > 0 ? (spent / effective) * 100 : 0;
      const variance = effective - spent;

      return {
        budget: b,
        categoryName: cat?.name ?? null,
        categoryColor: cat?.color ?? null,
        spent,
        effective,
        utilization,
        variance,
      };
    });
  }, [budgets, transactions, categories]);

  // Summary totals
  const summary = useMemo(() => {
    const totalBudgeted = budgetActuals.reduce((s, b) => s + b.effective, 0);
    const totalSpent = budgetActuals.reduce((s, b) => s + b.spent, 0);
    const overBudgetCount = budgetActuals.filter((b) => b.utilization >= 100).length;
    const nearLimitCount = budgetActuals.filter((b) => b.utilization >= 80 && b.utilization < 100).length;

    return {
      totalBudgeted,
      totalSpent,
      remaining: totalBudgeted - totalSpent,
      overBudgetCount,
      nearLimitCount,
      budgetCount: budgetActuals.length,
    };
  }, [budgetActuals]);

  // Copy budgets from one period to another
  const createBudgetsFromTemplate = useCallback(
    async (sourcePeriod: string, targetPeriod: string) => {
      if (!isSupabaseConfigured()) return false;

      const allBudgets = useFinancialStore.getState().budgets;
      const sourceBudgets = allBudgets.filter((b) =>
        b.period_start.startsWith(sourcePeriod) &&
        (financialContext === 'all' || b.context === financialContext)
      );

      if (sourceBudgets.length === 0) return false;

      const newBudgets = sourceBudgets.map((b) => ({
        category_id: b.category_id,
        period_type: b.period_type,
        period_start: `${targetPeriod}-01`,
        amount: b.amount,
        currency: b.currency,
        rollover: b.rollover,
        rollover_amount: 0,
        context: b.context,
        notes: b.notes,
      }));

      const { error } = await supabase.from('budgets').insert(newBudgets);
      if (error) {
        console.error('[BudgetTracking] Error copying budgets:', error);
        return false;
      }

      // Refetch budgets
      const { data } = await supabase
        .from('budgets')
        .select('*')
        .order('period_start', { ascending: false });
      if (data) {
        useFinancialStore.getState().setBudgets(data as Budget[]);
      }

      return true;
    },
    [financialContext]
  );

  // Process rollovers: carry unused budget from previous period
  const processRollovers = useCallback(
    async (targetPeriod: string) => {
      if (!isSupabaseConfigured()) return;

      const allBudgets = useFinancialStore.getState().budgets;
      const allTransactions = useFinancialStore.getState().transactions;

      // Find target period budgets with rollover enabled
      const targetBudgets = allBudgets.filter(
        (b) => b.period_start.startsWith(targetPeriod) && b.rollover
      );

      for (const tb of targetBudgets) {
        // Find the previous period's budget for the same category
        const prevPeriod = getPreviousPeriod(tb.period_start, tb.period_type);
        const prevBudget = allBudgets.find(
          (b) =>
            b.category_id === tb.category_id &&
            b.period_start === prevPeriod &&
            b.period_type === tb.period_type
        );

        if (!prevBudget) continue;

        const prevEnd = getPeriodEnd(prevPeriod, prevBudget.period_type);
        const prevSpent = allTransactions
          .filter(
            (t) =>
              t.transaction_type === 'expense' &&
              t.status !== 'void' &&
              t.category_id === tb.category_id &&
              t.transaction_date >= prevPeriod &&
              t.transaction_date < prevEnd
          )
          .reduce((sum, t) => sum + t.amount, 0);

        const prevEffective = prevBudget.amount + prevBudget.rollover_amount;
        const rolloverAmount = Math.max(0, prevEffective - prevSpent);

        if (rolloverAmount > 0) {
          await supabase
            .from('budgets')
            .update({ rollover_amount: rolloverAmount, updated_at: new Date().toISOString() })
            .eq('id', tb.id);

          useFinancialStore.getState().updateBudget(tb.id, { rollover_amount: rolloverAmount });
        }
      }
    },
    []
  );

  // Get budget alerts (categories over 80% utilization)
  const alerts = useMemo(() => {
    return budgetActuals
      .filter((b) => b.utilization >= 80)
      .sort((a, b) => b.utilization - a.utilization)
      .map((b) => ({
        categoryName: b.categoryName || 'Unknown',
        utilization: b.utilization,
        isOver: b.utilization >= 100,
        variance: b.variance,
      }));
  }, [budgetActuals]);

  // Fire notifications for budget alerts
  const checkAndNotifyBudgetAlerts = useCallback(async () => {
    for (const alert of alerts) {
      if (alert.isOver) {
        const fmtAmount = Math.abs(alert.variance).toLocaleString('en-ZA', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        await createNotificationDirect(
          'system',
          `Budget exceeded: ${alert.categoryName}`,
          `Over budget by R${fmtAmount} (${alert.utilization.toFixed(1)}% utilization)`,
          undefined,
          undefined,
          undefined,
          'warning'
        );
      }
    }
  }, [alerts]);

  return {
    budgetActuals,
    summary,
    alerts,
    createBudgetsFromTemplate,
    processRollovers,
    checkAndNotifyBudgetAlerts,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodEnd(periodStart: string, periodType: string): string {
  const d = new Date(periodStart);
  switch (periodType) {
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

function getPreviousPeriod(periodStart: string, periodType: string): string {
  const d = new Date(periodStart);
  switch (periodType) {
    case 'monthly':   d.setMonth(d.getMonth() - 1); break;
    case 'quarterly': d.setMonth(d.getMonth() - 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() - 1); break;
  }
  return d.toISOString().split('T')[0];
}
