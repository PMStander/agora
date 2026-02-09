import { useState, useEffect } from 'react';
import { usePayments } from '../../hooks/usePayments';
import type { PayPalConfig } from '../../types/payments';

export function PayPalSetup() {
  const { paymentSettings, savePaymentSettings, fetchPaymentSettings, loading } =
    usePayments();

  const [clientId, setClientId] = useState('');
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [currency, setCurrency] = useState('ZAR');
  const [isActive, setIsActive] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPaymentSettings();
  }, [fetchPaymentSettings]);

  useEffect(() => {
    if (paymentSettings) {
      const config = paymentSettings.config as PayPalConfig;
      setClientId(config.client_id || '');
      setMode(config.mode || 'sandbox');
      setCurrency(paymentSettings.currency || 'ZAR');
      setIsActive(paymentSettings.is_active);
    }
  }, [paymentSettings]);

  const handleSave = async () => {
    await savePaymentSettings(
      { client_id: clientId, mode },
      currency,
      isActive
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-2 h-2 rounded-full ${
            paymentSettings?.is_active ? 'bg-green-400' : 'bg-zinc-600'
          }`}
        />
        <span className="text-sm text-zinc-400">
          {paymentSettings?.is_active ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {/* Client ID */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          PayPal Client ID
        </label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Enter your PayPal Client ID"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
        />
        <p className="text-[10px] text-zinc-600 mt-1">
          Get this from developer.paypal.com -- Apps & Credentials
        </p>
      </div>

      {/* Client Secret note */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <p className="text-xs text-amber-400">
          Client Secret should be stored in environment variables or a Supabase
          Edge Function -- never in the browser. For sandbox testing, you can
          pass it at call time via the capture/create flows.
        </p>
      </div>

      {/* Mode */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          Mode
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('sandbox')}
            className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
              mode === 'sandbox'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Sandbox
          </button>
          <button
            onClick={() => setMode('live')}
            className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
              mode === 'live'
                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Live
          </button>
        </div>
      </div>

      {/* Currency */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          Default Currency
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
        >
          <option value="ZAR">ZAR - South African Rand</option>
          <option value="USD">USD - US Dollar</option>
          <option value="EUR">EUR - Euro</option>
          <option value="GBP">GBP - British Pound</option>
        </select>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-300">Enable PayPal</span>
        <button
          onClick={() => setIsActive(!isActive)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            isActive ? 'bg-green-500' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              isActive ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={loading || !clientId}
        className="w-full px-4 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Saving...' : saved ? 'Saved!' : 'Save PayPal Settings'}
      </button>
    </div>
  );
}
