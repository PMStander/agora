import { useState } from 'react';
import { useEmail } from '../../hooks/useEmail';
import { useEmailStore } from '../../stores/email';
import { isGmailConfigured } from '../../lib/gmail';
import type { EmailAccount } from '../../types/email';

export function EmailAccountSetup() {
  const { connectGmail, completeGmailAuth, accounts, syncGmail } = useEmail();
  const store = useEmailStore();
  const [authCode, setAuthCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAuthInput, setShowAuthInput] = useState(false);

  const handleConnectGmail = () => {
    connectGmail();
    setShowAuthInput(true);
  };

  const handleSubmitCode = async () => {
    if (!authCode.trim() || connecting) return;
    setConnecting(true);
    await completeGmailAuth(authCode.trim());
    setAuthCode('');
    setConnecting(false);
    setShowAuthInput(false);
  };

  const handleSync = async (account: EmailAccount) => {
    setSyncing(account.id);
    await syncGmail(account);
    setSyncing(null);
  };

  const handleSetDefault = async (accountId: string) => {
    // Handled via store update - in a real implementation this would update via supabase
    const { supabase } = await import('../../lib/supabase');
    // Unset all defaults
    await supabase.from('email_accounts').update({ is_default: false }).neq('id', '');
    // Set new default
    await supabase
      .from('email_accounts')
      .update({ is_default: true })
      .eq('id', accountId);

    // Update store
    for (const acc of store.accounts) {
      store.updateAccount(acc.id, { is_default: acc.id === accountId });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Email Accounts</h3>

        {/* Connected Accounts */}
        {accounts.length > 0 ? (
          <div className="space-y-2 mb-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">
                      {account.email_address}
                    </span>
                    {account.is_default && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="px-2 py-0.5 text-[10px] bg-zinc-700 text-zinc-400 rounded-full capitalize">
                    {account.provider}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {account.provider === 'gmail' && (
                    <button
                      onClick={() => handleSync(account)}
                      disabled={syncing === account.id}
                      className="px-2 py-1 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                    >
                      {syncing === account.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}
                  {!account.is_default && (
                    <button
                      onClick={() => handleSetDefault(account.id)}
                      className="px-2 py-1 text-[10px] bg-zinc-700 text-zinc-400 rounded hover:bg-zinc-600 transition-colors"
                    >
                      Set Default
                    </button>
                  )}
                </div>
                {account.last_synced_at && (
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Last synced: {new Date(account.last_synced_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mb-4">No email accounts connected</p>
        )}

        {/* Connect Gmail */}
        <div className="bg-zinc-800/30 border border-zinc-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-200 mb-2">Connect Gmail</h4>
          {!isGmailConfigured() ? (
            <p className="text-xs text-zinc-500">
              Gmail not configured. Set VITE_GMAIL_CLIENT_ID and VITE_GOOGLE_OAUTH_CLIENT_SECRET
              in your .env file.
            </p>
          ) : showAuthInput ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                A browser window has opened for Google sign-in.
                After authorizing, paste the authorization code below.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste authorization code..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
                <button
                  onClick={handleSubmitCode}
                  disabled={!authCode.trim() || connecting}
                  className="px-4 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
              <button
                onClick={() => setShowAuthInput(false)}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGmail}
              className="px-4 py-2 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              Connect Gmail Account
            </button>
          )}
        </div>

        {/* Apple Mail */}
        <div className="bg-zinc-800/30 border border-zinc-700 rounded-lg p-4 mt-3">
          <h4 className="text-sm font-medium text-zinc-200 mb-2">Apple Mail</h4>
          <p className="text-xs text-zinc-500 mb-2">
            Uses your default mail app via mailto: links. No configuration needed.
          </p>
          <p className="text-xs text-zinc-500">
            Emails sent via Apple Mail are not tracked in the CRM automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
