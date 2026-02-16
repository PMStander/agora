import { useState, useEffect } from 'react';
import { useFinancial } from '../../hooks/useFinancial';
import { useActiveCategories, useAllActiveBankAccounts } from '../../stores/financial';
import type { RecurringItem, RecurringItemType, RecurringFrequency, FinancialContext } from '../../types/financial';

interface RecurringItemFormProps {
  editItem?: RecurringItem | null;
  onClose: () => void;
}

export function RecurringItemForm({ editItem, onClose }: RecurringItemFormProps) {
  const { createRecurringItem, updateRecurringItem } = useFinancial();
  const categories = useActiveCategories();
  const bankAccounts = useAllActiveBankAccounts();
  const isEditing = !!editItem;

  const [itemType, setItemType] = useState<RecurringItemType>(editItem?.item_type ?? 'expense');
  const [name, setName] = useState(editItem?.name ?? '');
  const [description, _setDescription] = useState(editItem?.description ?? '');
  const [amount, setAmount] = useState(editItem?.amount?.toString() ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(editItem?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(
    editItem?.start_date ?? new Date().toISOString().split('T')[0]
  );
  const [nextDueDate, setNextDueDate] = useState(
    editItem?.next_due_date ?? new Date().toISOString().split('T')[0]
  );
  const [endDate, _setEndDate] = useState(editItem?.end_date ?? '');
  const [categoryId, setCategoryId] = useState(editItem?.category_id ?? '');
  const [bankAccountId, setBankAccountId] = useState(editItem?.bank_account_id ?? '');
  const [payeeName, setPayeeName] = useState(editItem?.payee_name ?? '');
  const [retainerHours, setRetainerHours] = useState(editItem?.retainer_hours?.toString() ?? '');
  const [hourlyRate, setHourlyRate] = useState(editItem?.hourly_rate?.toString() ?? '');
  const [autoCreate, setAutoCreate] = useState(editItem?.auto_create_transaction ?? false);
  const [context, setContext] = useState<FinancialContext>(editItem?.context ?? 'business');
  const [notes, setNotes] = useState(editItem?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;

  // Filter accounts by context
  const contextAccounts = bankAccounts.filter(
    (a) => a.context === context || a.context === 'both'
  );

  // Auto-select default account when context changes (only if not editing with existing value)
  useEffect(() => {
    if (isEditing && editItem?.bank_account_id) return;
    const defaultAcc = contextAccounts.find((a) => a.is_default);
    if (defaultAcc) {
      setBankAccountId(defaultAcc.id);
    } else if (contextAccounts.length > 0) {
      setBankAccountId(contextAccounts[0].id);
    } else {
      setBankAccountId('');
    }
  }, [context]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validation: account required when auto-create is on
  const accountRequired = autoCreate;
  const accountMissing = accountRequired && !bankAccountId;

  const handleSubmit = async () => {
    if (!name.trim() || parsedAmount <= 0) return;
    if (accountMissing) return;
    setSaving(true);

    const input = {
      item_type: itemType,
      name: name.trim(),
      description: description || null,
      amount: parsedAmount,
      currency: 'ZAR',
      frequency,
      start_date: startDate,
      end_date: endDate || null,
      next_due_date: nextDueDate,
      category_id: categoryId || null,
      bank_account_id: bankAccountId || null,
      payee_name: payeeName || null,
      contact_id: null,
      company_id: null,
      retainer_hours: retainerHours ? parseFloat(retainerHours) : null,
      hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
      auto_create_transaction: autoCreate,
      variance_threshold_pct: 10,
      is_active: true,
      last_generated_at: null,
      context,
      tags: [],
      notes: notes || null,
    };

    if (isEditing && editItem) {
      await updateRecurringItem(editItem.id, input);
    } else {
      await createRecurringItem(input);
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-200">
            {isEditing ? 'Edit Recurring Item' : 'Add Recurring Item'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Type toggle */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Type</label>
            <div className="flex gap-1">
              {(['expense', 'income', 'retainer'] as RecurringItemType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setItemType(t)}
                  className={`
                    flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize
                    ${itemType === t
                      ? t === 'expense' ? 'bg-red-500/20 text-red-400'
                        : t === 'retainer' ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-green-500/20 text-green-400'
                      : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800'
                    }
                  `}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={itemType === 'retainer' ? 'Client ABC Retainer' : itemType === 'expense' ? 'Office Rent' : 'Consulting Income'}
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Amount + Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Amount (ZAR) *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Start date + Next due date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Next Due Date</label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Category + Payee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {itemType === 'expense' ? 'Payee' : 'Client / Source'}
              </label>
              <input
                type="text"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder={itemType === 'retainer' ? 'Client name' : 'Who gets paid?'}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Context + Auto-create */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Context</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setContext('business')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                    ${context === 'business' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 bg-zinc-800'}
                  `}
                >
                  Business
                </button>
                <button
                  onClick={() => setContext('personal')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                    ${context === 'personal' ? 'bg-green-500/20 text-green-400' : 'text-zinc-500 bg-zinc-800'}
                  `}
                >
                  Personal
                </button>
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreate}
                  onChange={(e) => setAutoCreate(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                Auto-create transaction
              </label>
            </div>
          </div>

          {/* Bank Account - always shown */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Account{accountRequired ? ' *' : ''}
            </label>
            {contextAccounts.length === 0 && bankAccounts.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                No accounts set up. Create one in the Accounts tab.
              </div>
            ) : (
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className={`w-full px-3 py-2 text-sm bg-zinc-800 border rounded-lg text-zinc-200 focus:outline-none ${
                  accountMissing ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-700 focus:border-amber-500'
                }`}
              >
                <option value="">No account</option>
                {contextAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency}){acc.is_default ? ' - Default' : ''}</option>
                ))}
              </select>
            )}
            {accountMissing && (
              <p className="text-[10px] text-red-400 mt-1">
                Account required when auto-create is enabled
              </p>
            )}
          </div>

          {/* Retainer-specific fields */}
          {itemType === 'retainer' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Hours per period</label>
                <input
                  type="number"
                  value={retainerHours}
                  onChange={(e) => setRetainerHours(e.target.value)}
                  placeholder="20"
                  min="0"
                  step="0.5"
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Hourly rate (ZAR)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="750"
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || parsedAmount <= 0 || accountMissing}
            className="px-4 py-2 text-sm bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
