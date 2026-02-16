import { useState } from 'react';
import { useFinancial } from '../../hooks/useFinancial';
import { useAllActiveBankAccounts } from '../../stores/financial';

interface CreateTransferModalProps {
  onClose: () => void;
}

export function CreateTransferModal({ onClose }: CreateTransferModalProps) {
  const { createTransaction } = useFinancial();
  const bankAccounts = useAllActiveBankAccounts();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const fromAccount = bankAccounts.find((a) => a.id === fromAccountId);
  const toAccount = bankAccounts.find((a) => a.id === toAccountId);

  // Prevent selecting same account for both sides
  const toOptions = bankAccounts.filter((a) => a.id !== fromAccountId);
  const fromOptions = bankAccounts.filter((a) => a.id !== toAccountId);

  const fromCurrency = fromAccount?.currency || 'ZAR';
  const fromSymbol = fromCurrency === 'ZAR' ? 'R' : fromCurrency === 'EUR' ? '\u20AC' : fromCurrency === 'GBP' ? '\u00A3' : '$';

  const handleSubmit = async () => {
    if (!fromAccountId || !toAccountId || parsedAmount <= 0) return;
    if (fromAccountId === toAccountId) return;
    setSaving(true);

    const refNumber = `XFER-${Date.now()}`;
    const txDate = new Date(transferDate).toISOString();
    const descText = description.trim() || `Transfer from ${fromAccount?.name} to ${toAccount?.name}`;

    // Create outgoing transaction (expense from source account)
    await createTransaction({
      transaction_type: 'expense',
      status: 'completed',
      amount: parsedAmount,
      currency: fromAccount?.currency || 'ZAR',
      category_id: null,
      bank_account_id: fromAccountId,
      invoice_payment_id: null,
      invoice_id: null,
      order_id: null,
      deal_id: null,
      recurring_item_id: null,
      context: (fromAccount?.context as 'business' | 'personal') || 'business',
      payee_name: toAccount?.name || null,
      payee_contact_id: null,
      payee_company_id: null,
      description: descText,
      reference_number: refNumber,
      transaction_date: txDate,
      receipt_url: null,
      tax_amount: 0,
      tax_rate_id: null,
      is_tax_inclusive: false,
      tags: ['transfer'],
      notes: notes || null,
    });

    // Create incoming transaction (income to destination account)
    await createTransaction({
      transaction_type: 'income',
      status: 'completed',
      amount: parsedAmount,
      currency: toAccount?.currency || 'ZAR',
      category_id: null,
      bank_account_id: toAccountId,
      invoice_payment_id: null,
      invoice_id: null,
      order_id: null,
      deal_id: null,
      recurring_item_id: null,
      context: (toAccount?.context as 'business' | 'personal') || 'business',
      payee_name: fromAccount?.name || null,
      payee_contact_id: null,
      payee_company_id: null,
      description: descText,
      reference_number: refNumber,
      transaction_date: txDate,
      receipt_url: null,
      tax_amount: 0,
      tax_rate_id: null,
      is_tax_inclusive: false,
      tags: ['transfer'],
      notes: notes || null,
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-200">Transfer Between Accounts</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {bankAccounts.length < 2 ? (
            <div className="text-center py-6">
              <p className="text-sm text-zinc-400">
                You need at least 2 accounts to make a transfer.
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Create accounts in the Accounts tab first.
              </p>
            </div>
          ) : (
            <>
              {/* From Account */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">From Account *</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Select account...</option>
                  {fromOptions.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency}) — {acc.context === 'personal' ? 'Personal' : 'Business'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Arrow indicator */}
              <div className="flex justify-center">
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 text-lg">
                  ↓
                </span>
              </div>

              {/* To Account */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">To Account *</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Select account...</option>
                  {toOptions.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency}) — {acc.context === 'personal' ? 'Personal' : 'Business'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-mono">{fromSymbol}</span>
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
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={fromAccount && toAccount ? `Transfer from ${fromAccount.name} to ${toAccount.name}` : 'Transfer description'}
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                />
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

              {/* Transfer summary */}
              {fromAccount && toAccount && parsedAmount > 0 && (
                <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-3 space-y-1">
                  <p className="text-xs text-zinc-400">Transfer Summary</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-red-400 font-mono">-{fromSymbol}{parsedAmount.toFixed(2)}</span>
                    <span className="text-zinc-500">from</span>
                    <span className="text-zinc-300">{fromAccount.name}</span>
                    <span className={`text-[10px] px-1 py-0.5 rounded ${
                      fromAccount.context === 'personal' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {fromAccount.context === 'personal' ? 'Personal' : 'Business'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-400 font-mono">+{fromSymbol}{parsedAmount.toFixed(2)}</span>
                    <span className="text-zinc-500">to</span>
                    <span className="text-zinc-300">{toAccount.name}</span>
                    <span className={`text-[10px] px-1 py-0.5 rounded ${
                      toAccount.context === 'personal' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {toAccount.context === 'personal' ? 'Personal' : 'Business'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
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
            disabled={saving || !fromAccountId || !toAccountId || parsedAmount <= 0 || fromAccountId === toAccountId || bankAccounts.length < 2}
            className="px-4 py-2 text-sm bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}
