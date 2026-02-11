import { useState } from 'react';
import { useFinancialStore, useActiveBankAccounts } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';
import { ACCOUNT_TYPE_CONFIG } from '../../types/financial';
import type { AccountType } from '../../types/financial';

export function AccountList() {
  const accounts = useActiveBankAccounts();
  const selectAccount = useFinancialStore((s) => s.selectAccount);
  const selectedId = useFinancialStore((s) => s.selectedAccountId);
  const { createBankAccount, updateBankAccount, deleteBankAccount } = useFinancial();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState('USD');
  const [openingBalance, setOpeningBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [last4, setLast4] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  const resetForm = () => {
    setName('');
    setAccountType('checking');
    setCurrency('USD');
    setOpeningBalance('');
    setInstitution('');
    setLast4('');
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const balance = parseFloat(openingBalance) || 0;

    if (editingId) {
      await updateBankAccount(editingId, {
        name: name.trim(),
        account_type: accountType,
        currency,
        current_balance: balance,
        institution_name: institution || null,
        account_number_last4: last4 || null,
        notes: notes || null,
      });
    } else {
      await createBankAccount({
        name: name.trim(),
        account_type: accountType,
        currency,
        opening_balance: balance,
        current_balance: balance,
        institution_name: institution || null,
        account_number_last4: last4 || null,
        is_default: accounts.length === 0,
        is_active: true,
        notes: notes || null,
        context: 'business',
      });
    }

    setSaving(false);
    resetForm();
  };

  const handleEdit = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    setName(acc.name);
    setAccountType(acc.account_type);
    setCurrency(acc.currency);
    setOpeningBalance(acc.current_balance.toString());
    setInstitution(acc.institution_name || '');
    setLast4(acc.account_number_last4 || '');
    setNotes(acc.notes || '');
    setEditingId(id);
    setShowForm(true);
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">Accounts</h3>
          <span className="text-xs text-zinc-500">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-blue-400">
            Total: ${fmt(totalBalance)}
          </span>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="px-3 py-1.5 text-xs bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Account'}
          </button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Account Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Business Checking"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                {Object.entries(ACCOUNT_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="ZAR">ZAR</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {editingId ? 'Current Balance' : 'Opening Balance'}
              </label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Institution</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Bank name"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className="px-4 py-1.5 text-xs bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Update Account' : 'Add Account'}
            </button>
          </div>
        </div>
      )}

      {/* Account cards */}
      {accounts.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
          <div className="text-4xl mb-3">🏦</div>
          <p className="text-sm">No accounts set up yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Add a bank account or cash drawer to track your balances
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {accounts.map((acc) => {
            const typeConfig = ACCOUNT_TYPE_CONFIG[acc.account_type];
            const isSelected = acc.id === selectedId;

            return (
              <div
                key={acc.id}
                onClick={() => selectAccount(isSelected ? null : acc.id)}
                className={`group rounded-xl border p-4 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{typeConfig.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{acc.name}</p>
                      <p className="text-xs text-zinc-500">{typeConfig.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(acc.id);
                      }}
                      className="p-1 text-xs text-zinc-500 hover:text-zinc-300"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Deactivate ${acc.name}?`)) {
                          deleteBankAccount(acc.id);
                        }
                      }}
                      className="p-1 text-xs text-zinc-500 hover:text-red-400"
                      title="Deactivate"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-mono font-semibold text-zinc-100">
                  {acc.currency === 'ZAR' ? 'R' : '$'}{fmt(acc.current_balance)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-zinc-600">{acc.currency}</span>
                  {acc.institution_name && (
                    <span className="text-xs text-zinc-600">{acc.institution_name}</span>
                  )}
                  {acc.account_number_last4 && (
                    <span className="text-xs text-zinc-600">****{acc.account_number_last4}</span>
                  )}
                  {acc.is_default && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      Default
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
