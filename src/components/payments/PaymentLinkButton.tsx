import { useState, useEffect, useCallback } from 'react';
import { usePayments } from '../../hooks/usePayments';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import type { PaymentLink, PayPalConfig } from '../../types/payments';

interface PaymentLinkButtonProps {
  invoiceId: string;
  invoiceAmountDue: number;
}

export function PaymentLinkButton({
  invoiceId,
  invoiceAmountDue,
}: PaymentLinkButtonProps) {
  const {
    paymentSettings,
    loading,
    createPaymentLink,
    capturePayment,
    checkPaymentStatus,
    getPaymentLinksForInvoice,
    getPayPalAccessToken,
    isPayPalActive,
  } = usePayments();

  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [showSecretForm, setShowSecretForm] = useState(false);
  const [action, setAction] = useState<'create' | 'capture' | 'check' | null>(null);
  const [targetLinkId, setTargetLinkId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    const data = await getPaymentLinksForInvoice(invoiceId);
    setLinks(data);
  }, [invoiceId, getPaymentLinksForInvoice]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  if (!isPayPalActive || invoiceAmountDue <= 0) return null;

  const config = paymentSettings?.config as PayPalConfig | undefined;
  if (!config?.client_id) return null;

  const handleAction = async () => {
    if (!secretInput.trim()) {
      setError('Client secret is required');
      return;
    }
    setError(null);

    try {
      const token = await getPayPalAccessToken(
        config.client_id,
        secretInput.trim(),
        config.mode
      );

      if (action === 'create') {
        const link = await createPaymentLink(invoiceId, token);
        if (link) {
          setLinks((prev) => [link, ...prev]);
        } else {
          setError('Failed to create payment link');
        }
      } else if (action === 'capture' && targetLinkId) {
        const ok = await capturePayment(targetLinkId, token);
        if (ok) {
          await loadLinks();
        } else {
          setError('Capture failed -- has the payer approved the payment?');
        }
      } else if (action === 'check' && targetLinkId) {
        const updated = await checkPaymentStatus(targetLinkId, token);
        if (updated) {
          setLinks((prev) =>
            prev.map((l) => (l.id === updated.id ? updated : l))
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    }

    setSecretInput('');
    setShowSecretForm(false);
    setAction(null);
    setTargetLinkId(null);
  };

  const startAction = (
    act: 'create' | 'capture' | 'check',
    linkId?: string
  ) => {
    setAction(act);
    setTargetLinkId(linkId ?? null);
    setShowSecretForm(true);
    setError(null);
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeLink = links.find(
    (l) => l.status === 'created' || l.status === 'approved'
  );

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
        PayPal Payment
      </h4>

      {/* Existing links */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((link) => (
            <div
              key={link.id}
              className="bg-zinc-800/30 border border-zinc-800 rounded p-2 space-y-1"
            >
              <div className="flex items-center justify-between">
                <PaymentStatusBadge status={link.status} />
                <span className="text-[10px] text-zinc-600">
                  {new Date(link.created_at).toLocaleDateString()}
                </span>
              </div>

              {link.checkout_url && link.status === 'created' && (
                <div className="flex gap-1">
                  <input
                    readOnly
                    value={link.checkout_url}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-400 truncate"
                  />
                  <button
                    onClick={() => handleCopy(link.checkout_url!)}
                    className="px-2 py-1 text-[10px] bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors shrink-0"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}

              {(link.status === 'created' || link.status === 'approved') && (
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => startAction('check', link.id)}
                    disabled={loading}
                    className="flex-1 px-2 py-1 text-[10px] bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
                  >
                    Check Status
                  </button>
                  {link.status === 'approved' && (
                    <button
                      onClick={() => startAction('capture', link.id)}
                      disabled={loading}
                      className="flex-1 px-2 py-1 text-[10px] bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                    >
                      Capture
                    </button>
                  )}
                </div>
              )}

              {link.payer_email && (
                <p className="text-[10px] text-zinc-500">
                  Payer: {link.payer_name || link.payer_email}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create new link */}
      {!activeLink && (
        <button
          onClick={() => startAction('create')}
          disabled={loading}
          className="w-full px-3 py-2 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating...' : 'Create PayPal Payment Link'}
        </button>
      )}

      {/* Secret input form (shown when action requires auth) */}
      {showSecretForm && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-2">
          <p className="text-[10px] text-zinc-500">
            Enter PayPal Client Secret to authenticate this action.
            {config.mode === 'sandbox' && ' (Sandbox mode)'}
          </p>
          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            placeholder="PayPal Client Secret"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAction();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowSecretForm(false);
                setAction(null);
                setSecretInput('');
              }}
              className="flex-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAction}
              disabled={loading || !secretInput.trim()}
              className="flex-1 px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
            >
              {loading
                ? 'Processing...'
                : action === 'create'
                  ? 'Create Link'
                  : action === 'capture'
                    ? 'Capture Payment'
                    : 'Check Status'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[10px] text-red-400 bg-red-500/10 rounded p-2">
          {error}
        </p>
      )}
    </div>
  );
}
