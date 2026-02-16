import { useState, useMemo } from 'react';
import { useFinancialStore, useActiveBankAccounts } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';
import { ACCOUNT_TYPE_CONFIG } from '../../types/financial';
import type { AccountType, FinancialContext, BankAccount } from '../../types/financial';
import { supabase } from '../../lib/supabase';
import { CreateTransferModal } from './CreateTransferModal';

export function AccountList() {
  const accounts = useActiveBankAccounts();
  const allAccounts = useFinancialStore((s) => s.bankAccounts).filter((a) => a.is_active);
  const financialContext = useFinancialStore((s) => s.financialContext);
  const selectAccount = useFinancialStore((s) => s.selectAccount);
  const selectedId = useFinancialStore((s) => s.selectedAccountId);
  const { createBankAccount, updateBankAccount, deleteBankAccount } = useFinancial();

  const [showForm, setShowForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [context, setContext] = useState<FinancialContext>('business');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState('ZAR');
  const [openingBalance, setOpeningBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [last4, setLast4] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const currencySymbol = (c: string) => (c === 'ZAR' ? 'R' : c === 'EUR' ? '\u20AC' : c === 'GBP' ? '\u00A3' : '$');

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Count accounts per context to auto-check default for first account
  const accountsForContext = allAccounts.filter((a) => a.context === context || a.context === 'both');
  const isFirstForContext = accountsForContext.length === 0;

  // Group accounts by context for "All" view
  const { businessAccounts, personalAccounts } = useMemo(() => {
    const biz = accounts.filter((a) => a.context === 'business' || a.context === 'both');
    const per = accounts.filter((a) => a.context === 'personal' || a.context === 'both');
    return { businessAccounts: biz, personalAccounts: per };
  }, [accounts]);

  const resetForm = () => {
    setContext('business');
    setName('');
    setAccountType('checking');
    setCurrency('ZAR');
    setOpeningBalance('');
    setInstitution('');
    setLast4('');
    setIsDefault(false);
    setNotes('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const balance = parseFloat(openingBalance) || 0;
    const shouldBeDefault = isDefault || isFirstForContext;

    // If setting as default, clear existing defaults for this context
    if (shouldBeDefault) {
      const othersToUnset = allAccounts.filter(
        (a) => a.is_default && (a.context === context || a.context === 'both') && a.id !== editingId
      );
      for (const acc of othersToUnset) {
        await supabase.from('bank_accounts').update({ is_default: false }).eq('id', acc.id);
      }
    }

    if (editingId) {
      await updateBankAccount(editingId, {
        name: name.trim(),
        account_type: accountType,
        currency,
        current_balance: balance,
        institution_name: institution || null,
        account_number_last4: last4 || null,
        is_default: shouldBeDefault,
        context,
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
        is_default: shouldBeDefault,
        is_active: true,
        context,
        notes: notes || null,
      });
    }

    setSaving(false);
    resetForm();
  };

  const handleEdit = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    setContext((acc.context as FinancialContext) || 'business');
    setName(acc.name);
    setAccountType(acc.account_type);
    setCurrency(acc.currency);
    setOpeningBalance(acc.current_balance.toString());
    setInstitution(acc.institution_name || '');
    setLast4(acc.account_number_last4 || '');
    setIsDefault(acc.is_default);
    setNotes(acc.notes || '');
    setEditingId(id);
    setShowForm(true);
  };

  const renderAccountCard = (acc: BankAccount) => {
    const typeConfig = ACCOUNT_TYPE_CONFIG[acc.account_type];
    const isSelected = acc.id === selectedId;
    const contextColor = acc.context === 'personal'
      ? 'border-l-green-500/40'
      : 'border-l-blue-500/40';

    return (
      <div
        key={acc.id}
        onClick={() => selectAccount(isSelected ? null : acc.id)}
        className={`group rounded-xl border-l-3 ${contextColor} border p-4 cursor-pointer transition-all ${
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
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-zinc-500">{typeConfig.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                  acc.context === 'personal'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  {acc.context === 'personal' ? 'Personal' : 'Business'}
                </span>
              </div>
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
          {currencySymbol(acc.currency)}{fmt(acc.current_balance)}
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
  };

  const renderAccountGrid = (accs: BankAccount[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accs.map(renderAccountCard)}
    </div>
  );

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
            Total: {currencySymbol(accounts[0]?.currency || 'ZAR')}{fmt(totalBalance)}
          </span>
          {accounts.length >= 2 && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg hover:text-zinc-200 hover:border-zinc-500 transition-colors"
            >
              Transfer
            </button>
          )}
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
          {/* Context selector - first field */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Account Type</label>
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
            {isFirstForContext && !editingId && (
              <p className="text-[10px] text-zinc-500 mt-1">
                First {context} account — will be set as default automatically
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Account Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={context === 'personal' ? 'e.g. Personal Savings' : 'e.g. Business Checking'}
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
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault || isFirstForContext}
                disabled={isFirstForContext && !editingId}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Set as default for {context === 'personal' ? 'Personal' : 'Business'}
            </label>
            <div className="flex items-center gap-2">
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
      ) : financialContext === 'all' ? (
        /* Grouped view when showing all */
        <div className="p-4 space-y-6">
          {businessAccounts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-blue-500/60" />
                  <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    Business Accounts
                  </h4>
                  <span className="text-xs text-zinc-600">({businessAccounts.length})</span>
                </div>
                <span className="text-xs font-mono text-blue-400/70">
                  {currencySymbol(businessAccounts[0]?.currency || 'ZAR')}
                  {fmt(businessAccounts.reduce((s, a) => s + a.current_balance, 0))}
                </span>
              </div>
              {renderAccountGrid(businessAccounts)}
            </div>
          )}
          {personalAccounts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-green-500/60" />
                  <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                    Personal Accounts
                  </h4>
                  <span className="text-xs text-zinc-600">({personalAccounts.length})</span>
                </div>
                <span className="text-xs font-mono text-green-400/70">
                  {currencySymbol(personalAccounts[0]?.currency || 'ZAR')}
                  {fmt(personalAccounts.reduce((s, a) => s + a.current_balance, 0))}
                </span>
              </div>
              {renderAccountGrid(personalAccounts)}
            </div>
          )}
        </div>
      ) : (
        /* Flat grid when filtered to specific context */
        <div className="p-4">
          {renderAccountGrid(accounts)}
        </div>
      )}

      {/* Transfer Modal placeholder - will be implemented in Phase 6 */}
      {showTransferModal && (
        <CreateTransferModal onClose={() => setShowTransferModal(false)} />
      )}
    </div>
  );
}

