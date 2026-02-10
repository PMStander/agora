import { useState } from 'react';
import { useFinancialStore, useActiveTaxRates } from '../../stores/financial';
import { useFinancial } from '../../hooks/useFinancial';
import type { TaxType } from '../../types/financial';

export function TaxRatesPanel() {
  const taxRates = useActiveTaxRates();
  const allTaxRates = useFinancialStore((s) => s.taxRates);
  const { createTaxRate, updateTaxRate, deleteTaxRate } = useFinancial();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [taxType, setTaxType] = useState<TaxType>('vat');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setRate('');
    setCountry('');
    setRegion('');
    setTaxType('vat');
    setIsDefault(false);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const parsedRate = parseFloat(rate) || 0;

    if (editingId) {
      await updateTaxRate(editingId, {
        name: name.trim(),
        rate: parsedRate,
        country: country || null,
        region: region || null,
        tax_type: taxType,
        is_default: isDefault,
      });
    } else {
      await createTaxRate({
        name: name.trim(),
        rate: parsedRate,
        country: country || null,
        region: region || null,
        tax_type: taxType,
        is_compound: false,
        is_default: isDefault,
        is_active: true,
      });
    }

    setSaving(false);
    resetForm();
  };

  const handleEdit = (id: string) => {
    const tr = allTaxRates.find((r) => r.id === id);
    if (!tr) return;
    setName(tr.name);
    setRate(tr.rate.toString());
    setCountry(tr.country || '');
    setRegion(tr.region || '');
    setTaxType(tr.tax_type);
    setIsDefault(tr.is_default);
    setEditingId(id);
    setShowForm(true);
  };

  const taxTypeLabels: Record<TaxType, string> = {
    vat: 'VAT',
    sales: 'Sales Tax',
    gst: 'GST',
    other: 'Other',
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">Tax Rates</h3>
          <span className="text-xs text-zinc-500">
            {taxRates.length} active rate{taxRates.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-3 py-1.5 text-xs bg-amber-500 text-zinc-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Rate'}
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. VAT 15%"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Rate (%)</label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="15.00"
                step="0.01"
                min="0"
                max="100"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tax Type</label>
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value as TaxType)}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                {Object.entries(taxTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="ZA, US, ..."
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Set as default tax rate
            </label>
            <div className="flex gap-2">
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
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax rates list */}
      {taxRates.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">No tax rates configured</p>
          <p className="text-xs text-zinc-600 mt-1">
            Add tax rates to apply them to expenses and income
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {taxRates.map((tr) => (
            <div
              key={tr.id}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700">
                <span className="text-sm font-mono font-semibold text-zinc-200">
                  {tr.rate}%
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-200">{tr.name}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
                    {taxTypeLabels[tr.tax_type]}
                  </span>
                  {tr.is_default && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {tr.country && (
                    <span className="text-xs text-zinc-500">{tr.country}</span>
                  )}
                  {tr.region && (
                    <span className="text-xs text-zinc-600">{tr.region}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(tr.id)}
                  className="p-1.5 text-xs text-zinc-500 hover:text-zinc-300"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Deactivate ${tr.name}?`)) {
                      deleteTaxRate(tr.id);
                    }
                  }}
                  className="p-1.5 text-xs text-zinc-500 hover:text-red-400"
                  title="Deactivate"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
