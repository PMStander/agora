import { useEffect, useRef } from 'react';
import { useFinancialStore } from '../stores/financial';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createNotificationDirect } from './useNotifications';
import type { RecurringItem, FinancialTransaction, RecurringItemHistory } from '../types/financial';

/**
 * Processes recurring items that are due (next_due_date <= today).
 *
 * Behavior:
 * - For auto_create_transaction = false (default): creates a notification prompting the user
 * - For auto_create_transaction = true: auto-creates the transaction and history entry
 * - After processing, advances `next_due_date` by the item's frequency
 *
 * Called once per dashboard mount.
 */
export function useRecurringProcessor() {
  const processedRef = useRef(false);
  const recurringItems = useFinancialStore((s) => s.recurringItems);
  const updateRecurringItem = useFinancialStore((s) => s.updateRecurringItem);

  useEffect(() => {
    if (processedRef.current || !isSupabaseConfigured()) return;
    processedRef.current = true;

    processRecurringItems(recurringItems, updateRecurringItem);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function processRecurringItems(
  items: RecurringItem[],
  updateInStore: (id: string, updates: Partial<RecurringItem>) => void
) {
  const today = new Date().toISOString().split('T')[0];

  const dueItems = items.filter(
    (i) => i.is_active && i.next_due_date <= today
  );

  if (dueItems.length === 0) return;

  for (const item of dueItems) {
    try {
      if (item.auto_create_transaction) {
        await autoCreateTransaction(item);
      } else {
        await notifyUserOfDueItem(item);
      }

      // Advance next_due_date
      const nextDate = advanceDate(item.next_due_date, item.frequency);
      await supabase
        .from('recurring_items')
        .update({
          next_due_date: nextDate,
          last_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      updateInStore(item.id, {
        next_due_date: nextDate,
        last_generated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[RecurringProcessor] Error processing "${item.name}":`, err);
    }
  }
}

async function autoCreateTransaction(item: RecurringItem) {
  const today = new Date().toISOString().split('T')[0];

  // Create the transaction
  const { data: txn } = await supabase
    .from('financial_transactions')
    .insert({
      transaction_type: item.item_type === 'expense' ? 'expense' : 'income',
      status: 'completed',
      amount: item.amount,
      currency: item.currency,
      category_id: item.category_id,
      bank_account_id: item.bank_account_id,
      recurring_item_id: item.id,
      context: item.context,
      payee_name: item.payee_name,
      payee_contact_id: item.contact_id,
      payee_company_id: item.company_id,
      description: `Auto: ${item.name}`,
      transaction_date: today,
      tax_amount: 0,
      is_tax_inclusive: false,
      tags: item.tags,
    } as Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at'>)
    .select()
    .single();

  // Create history entry
  await supabase.from('recurring_item_history').insert({
    recurring_item_id: item.id,
    expected_date: item.next_due_date,
    expected_amount: item.amount,
    actual_amount: item.amount,
    transaction_id: txn?.id ?? null,
    status: 'matched',
    variance_pct: 0,
    hours_used: null,
  } as Omit<RecurringItemHistory, 'id' | 'created_at'>);

  // Send a notification to confirm it was auto-created
  const fmtAmount = item.amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  await createNotificationDirect(
    'system',
    `Auto-recorded: ${item.name}`,
    `R${fmtAmount} ${item.item_type === 'expense' ? 'expense' : 'income'} was automatically recorded.`,
    undefined,
    undefined,
    undefined,
    'info'
  );
}

async function notifyUserOfDueItem(item: RecurringItem) {
  const fmtAmount = item.amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const typeLabel = item.item_type === 'expense'
    ? 'expense'
    : item.item_type === 'retainer'
    ? 'retainer payment'
    : 'income';

  // Create history entry with "expected" status
  await supabase.from('recurring_item_history').insert({
    recurring_item_id: item.id,
    expected_date: item.next_due_date,
    expected_amount: item.amount,
    actual_amount: null,
    transaction_id: null,
    status: 'expected',
    variance_pct: null,
    hours_used: null,
  } as Omit<RecurringItemHistory, 'id' | 'created_at'>);

  await createNotificationDirect(
    'system',
    `${item.name} is due`,
    `R${fmtAmount} ${typeLabel} due${item.payee_name ? ` — ${item.payee_name}` : ''}. Record this transaction?`,
    undefined,
    undefined,
    undefined,
    'warning'
  );
}

function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
}
