import { useState, useEffect } from 'react';
import { useFinancial } from '../../hooks/useFinancial';
import { useActiveCategories, useAllActiveBankAccounts, useActiveTaxRates, useFinancialStore } from '../../stores/financial';
import type { FinancialContext } from '../../types/financial';

interface CreateIncomeModalProps {
  onClose: () => void;
}

export function CreateIncomeModal({ onClose }: CreateIncomeModalProps) {
  const { createTransaction } = useFinancial();
  const categories = useActiveCategories('income');
  const bankAccounts = useAllActiveBankAccounts();
  const taxRates = useActiveTaxRates();
  const financialContext = useFinancialStore((s) => s.financialContext);

  const [context, setContext] = useState<FinancialContext>(
    financialContext === 'all' ? 'business' : (financialContext as FinancialContext)
  );
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [taxRateId, setTaxRateId] = useState('');
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter accounts by selected context
  const contextAccounts = bankAccounts.filter(
    (a) => a.context === context || a.context === 'both'
  );

  // Auto-select default account when context changes
  useEffect(() => {
    const defaultAcc = contextAccounts.find((a) => a.is_default);
    if (defaultAcc) {
      setBankAccountId(defaultAcc.id);
    } else if (contextAccounts.length > 0) {
      setBankAccountId(contextAccounts[0].id);
    } else {
      setBankAccountId('');
    }
  }, [context]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get currency from selected account
  const selectedAccount = bankAccounts.find((a) => a.id === bankAccountId);
  const currency = selectedAccount?.currency || 'ZAR';
  const currencySymbol = currency === 'ZAR' ? 'R' : currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : '$';

  // Calculate tax
  const selectedTaxRate = taxRates.find((r) => r.id === taxRateId);
  const parsedAmount = parseFloat(amount) || 0;
  const taxAmount = selectedTaxRate
    ? isTaxInclusive
      ? parsedAmount - parsedAmount / (1 + selectedTaxRate.rate / 100)
      : parsedAmount * (selectedTaxRate.rate / 100)
    : 0;

  const handleSubmit = async () => {
    if (!description.trim() || parsedAmount <= 0 || !bankAccountId) return;
    setSaving(true);

    await createTransaction({
      transaction_type: 'income',
      status: 'completed',
      amount: parsedAmount,
      currency,
      category_id: categoryId || null,
      bank_account_id: bankAccountId,
      invoice_payment_id: null,
      invoice_id: null,
      order_id: null,
      deal_id: null,
      recurring_item_id: null,
      context,
      payee_name: payerName || null,
      payee_contact_id: null,
      payee_company_id: null,
      description: description.trim(),
      reference_number: referenceNumber || null,
      transaction_date: new Date(transactionDate).toISOString(),
      receipt_url: null,
      tax_amount: Math.round(taxAmount * 100) / 100,
      tax_rate_id: taxRateId || null,
      is_tax_inclusive: isTaxInclusive,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      notes: notes || null,
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-200">Add Income</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Context toggle */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Context</label>
            <div className="flex gap-1">
              <button
                onClick={() => setContext('business')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${context === 'business' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 bg-zinc-800 hover:text-zinc-300'}
                `}
              >
                Business
              </button>
              <button
                onClick={() => setContext('personal')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${context === 'personal' ? 'bg-green-500/20 text-green-400' : 'text-zinc-500 bg-zinc-800 hover:text-zinc-300'}
                `}
              >
                Personal
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this income for?"
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Amount ({currency}) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-mono">{currencySymbol}</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Date</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Received into Account */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Received into Account *</label>
            {contextAccounts.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500 bg-zinc-800/50 border border-zinc-700/50 rounded-lg">
                No {context} accounts set up.{' '}
                <button
                  onClick={onClose}
                  className="text-amber-400 hover:text-amber-300 underline"
                >
                  Create one in Accounts tab
                </button>
              </div>
            ) : (
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                {contextAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency}){acc.is_default ? ' - Default' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Category + Payer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Payer / Source</label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Who paid?"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Tax rate + inclusive */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tax Rate</label>
              <select
                value={taxRateId}
                onChange={(e) => setTaxRateId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">No tax</option>
                {taxRates.map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.name} ({rate.rate}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              {taxRateId && (
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTaxInclusive}
                    onChange={(e) => setIsTaxInclusive(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  Tax inclusive
                  {taxAmount > 0 && (
                    <span className="text-zinc-500 font-mono">
                      (Tax: {currencySymbol}{taxAmount.toFixed(2)})
                    </span>
                  )}
                </label>
              )}
            </div>
          </div>

          {/* Reference + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Reference #</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Receipt #, ref #"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

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
            disabled={saving || !description.trim() || parsedAmount <= 0 || !bankAccountId}
            className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Income'}
          </button>
        </div>
      </div>
    </div>
  );
}
