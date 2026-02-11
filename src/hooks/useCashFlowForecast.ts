import { useMemo } from 'react';
import { useFinancialStore, useActiveBankAccounts } from '../stores/financial';
import type { ForecastMonth, ForecastScenario, RecurringItem } from '../types/financial';

// ─── Scenario Multipliers ──────────────────────────────────────────────────

const SCENARIO_MULTIPLIERS: Record<ForecastScenario, { income: number; expenses: number; pipeline: number }> = {
  optimistic:   { income: 1.15, expenses: 0.90, pipeline: 1.0 },
  realistic:    { income: 1.0,  expenses: 1.0,  pipeline: 1.0 },
  pessimistic:  { income: 0.85, expenses: 1.10, pipeline: 0.5 },
};

// ─── Helper: Monthly amount for a recurring item ──────────────────────────

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':    return amount * 4.33;
    case 'biweekly':  return amount * 2.17;
    case 'monthly':   return amount;
    case 'quarterly': return amount / 3;
    case 'yearly':    return amount / 12;
    default:          return amount;
  }
}

// ─── Helper: Get month string from offset ─────────────────────────────────

function getMonthString(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
}

// ─── Check if recurring item is active for a given month ──────────────────

function isActiveForMonth(item: RecurringItem, monthStr: string): boolean {
  const monthStart = `${monthStr}-01`;
  const monthEnd = (() => {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m, 0); // last day of month
    return d.toISOString().split('T')[0];
  })();

  if (item.start_date > monthEnd) return false;
  if (item.end_date && item.end_date < monthStart) return false;
  return true;
}

// ─── Main Hook ─────────────────────────────────────────────────────────────

export function useCashFlowForecast(scenario: ForecastScenario = 'realistic') {
  const recurringItems = useFinancialStore((s) => s.recurringItems);
  const transactions = useFinancialStore((s) => s.transactions);
  const financialContext = useFinancialStore((s) => s.financialContext);
  const forecastMonths = useFinancialStore((s) => s.forecastMonths);
  const bankAccounts = useActiveBankAccounts();
  const multiplier = SCENARIO_MULTIPLIERS[scenario];

  // Current cash position across all active accounts
  const cashPosition = useMemo(
    () => bankAccounts.reduce((sum, a) => sum + a.current_balance, 0),
    [bankAccounts]
  );

  // Historical averages (last 6 months)
  const historicalAvg = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().split('T')[0];

    const recent = transactions.filter((t) => {
      if (t.status === 'void') return false;
      if (t.transaction_date < cutoff) return false;
      if (financialContext !== 'all' && t.context !== financialContext) return false;
      return true;
    });

    const totalIncome = recent
      .filter((t) => t.transaction_type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = recent
      .filter((t) => t.transaction_type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    const months = Math.max(1, 6);
    return {
      avgMonthlyIncome: totalIncome / months,
      avgMonthlyExpenses: totalExpenses / months,
    };
  }, [transactions, financialContext]);

  // Active recurring items filtered by context
  const activeRecurring = useMemo(() => {
    return recurringItems.filter((i) => {
      if (!i.is_active) return false;
      if (financialContext !== 'all' && i.context !== financialContext) return false;
      return true;
    });
  }, [recurringItems, financialContext]);

  // Historical months data (last 6 months from transactions)
  const historicalMonths = useMemo(() => {
    const months: { month: string; label: string; income: number; expenses: number; net: number }[] = [];

    for (let i = -6; i < 0; i++) {
      const monthStr = getMonthString(i);
      const monthPrefix = monthStr;

      const monthTxns = transactions.filter((t) => {
        if (t.status === 'void') return false;
        if (!t.transaction_date.startsWith(monthPrefix)) return false;
        if (financialContext !== 'all' && t.context !== financialContext) return false;
        return true;
      });

      const income = monthTxns
        .filter((t) => t.transaction_type === 'income')
        .reduce((s, t) => s + t.amount, 0);
      const expenses = monthTxns
        .filter((t) => t.transaction_type === 'expense')
        .reduce((s, t) => s + t.amount, 0);

      months.push({
        month: monthStr,
        label: getMonthLabel(monthStr),
        income,
        expenses,
        net: income - expenses,
      });
    }
    return months;
  }, [transactions, financialContext]);

  // Forecast months
  const forecast = useMemo(() => {
    const result: ForecastMonth[] = [];
    let runningBalance = cashPosition;

    for (let i = 0; i < forecastMonths; i++) {
      const monthStr = getMonthString(i);

      // Recurring income (income + retainer items)
      const recurringIncome = activeRecurring
        .filter((item) => (item.item_type === 'income') && isActiveForMonth(item, monthStr))
        .reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0);

      const retainerIncome = activeRecurring
        .filter((item) => item.item_type === 'retainer' && isActiveForMonth(item, monthStr))
        .reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0);

      // Recurring expenses
      const recurringExpenses = activeRecurring
        .filter((item) => item.item_type === 'expense' && isActiveForMonth(item, monthStr))
        .reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0);

      // Add any "additional" non-recurring income/expense estimates from historical averages
      // Only if we don't have many recurring items (they should cover the main flows)
      const hasSubstantialRecurring = activeRecurring.length >= 3;
      const additionalIncome = hasSubstantialRecurring ? 0 :
        Math.max(0, historicalAvg.avgMonthlyIncome - recurringIncome - retainerIncome) * 0.5;
      const additionalExpenses = hasSubstantialRecurring ? 0 :
        Math.max(0, historicalAvg.avgMonthlyExpenses - recurringExpenses) * 0.5;

      // Apply scenario multipliers
      const totalProjectedIncome = (recurringIncome + retainerIncome + additionalIncome) * multiplier.income;
      const totalProjectedExpenses = (recurringExpenses + additionalExpenses) * multiplier.expenses;
      const net = totalProjectedIncome - totalProjectedExpenses;

      runningBalance += net;

      result.push({
        month: monthStr,
        recurring_income: recurringIncome * multiplier.income,
        retainer_income: retainerIncome * multiplier.income,
        pipeline_weighted: 0, // Placeholder for CRM pipeline integration
        upcoming_invoices: 0, // Placeholder for invoice integration
        total_projected_income: totalProjectedIncome,
        recurring_expenses: recurringExpenses * multiplier.expenses,
        total_projected_expenses: totalProjectedExpenses,
        net_projected: net,
        cumulative_balance: runningBalance,
      });
    }

    return result;
  }, [activeRecurring, cashPosition, forecastMonths, multiplier, historicalAvg]);

  // Combined chart data: historical + forecast
  const chartData = useMemo(() => {
    const historical = historicalMonths.map((m) => ({
      month: m.label,
      monthKey: m.month,
      income: m.income,
      expenses: m.expenses,
      net: m.net,
      isProjected: false,
    }));

    const projected = forecast.map((m) => ({
      month: getMonthLabel(m.month),
      monthKey: m.month,
      income: m.total_projected_income,
      expenses: m.total_projected_expenses,
      net: m.net_projected,
      isProjected: true,
    }));

    return [...historical, ...projected];
  }, [historicalMonths, forecast]);

  // Summary KPIs
  const summary = useMemo(() => {
    const totalProjectedIncome = forecast.reduce((s, f) => s + f.total_projected_income, 0);
    const totalProjectedExpenses = forecast.reduce((s, f) => s + f.total_projected_expenses, 0);
    const endBalance = forecast.length > 0 ? forecast[forecast.length - 1].cumulative_balance : cashPosition;
    const lowestBalance = forecast.reduce((min, f) => Math.min(min, f.cumulative_balance), cashPosition);
    const monthsUntilNegative = forecast.findIndex((f) => f.cumulative_balance < 0);

    return {
      cashPosition,
      totalProjectedIncome,
      totalProjectedExpenses,
      endBalance,
      lowestBalance,
      monthsUntilNegative: monthsUntilNegative === -1 ? null : monthsUntilNegative,
      runwayMonths: monthsUntilNegative === -1 ? forecastMonths : monthsUntilNegative,
    };
  }, [forecast, cashPosition, forecastMonths]);

  return {
    forecast,
    chartData,
    historicalMonths,
    summary,
    cashPosition,
    scenario,
  };
}
