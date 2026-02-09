import { useMemo } from 'react';
import { useEmailStore, useInboxEmails, useSentEmails, useDraftEmails } from '../../stores/email';
import { EMAIL_STATUS_CONFIG } from '../../types/email';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    indigo: 'bg-indigo-500/20 text-indigo-400',
  };
  return map[color] || map.zinc;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface EmailListProps {
  contactId?: string;
  dealId?: string;
}

export function EmailList({ contactId, dealId }: EmailListProps) {
  const activeSubTab = useEmailStore((s) => s.activeSubTab);
  const searchQuery = useEmailStore((s) => s.searchQuery);
  const selectEmail = useEmailStore((s) => s.selectEmail);
  const selectedEmailId = useEmailStore((s) => s.selectedEmailId);
  const allEmails = useEmailStore((s) => s.emails);

  const inboxEmails = useInboxEmails();
  const sentEmails = useSentEmails();
  const draftEmails = useDraftEmails();

  const emails = useMemo(() => {
    let list = activeSubTab === 'inbox'
      ? inboxEmails
      : activeSubTab === 'sent'
        ? sentEmails
        : activeSubTab === 'drafts'
          ? draftEmails
          : [];

    // Filter by contact or deal if provided
    if (contactId) {
      list = allEmails.filter((e) => e.contact_id === contactId);
    } else if (dealId) {
      list = allEmails.filter((e) => e.deal_id === dealId);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.subject || '').toLowerCase().includes(q) ||
          (e.from_address || '').toLowerCase().includes(q) ||
          e.to_addresses.some((a) => a.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeSubTab, inboxEmails, sentEmails, draftEmails, allEmails, contactId, dealId, searchQuery]);

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">No emails found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {emails.map((email) => {
        const statusConfig = EMAIL_STATUS_CONFIG[email.status];
        const isSelected = email.id === selectedEmailId;
        const displayAddress =
          email.direction === 'inbound'
            ? email.from_address || 'Unknown'
            : email.to_addresses[0] || 'No recipient';

        return (
          <button
            key={email.id}
            onClick={() => selectEmail(email.id)}
            className={`w-full text-left px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${
              isSelected ? 'bg-zinc-800/70 border-l-2 border-l-amber-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-zinc-200 font-medium truncate max-w-[60%]">
                {displayAddress}
              </span>
              <span className="text-[10px] text-zinc-500 shrink-0">
                {relativeTime(email.sent_at || email.received_at || email.created_at)}
              </span>
            </div>
            <div className="text-sm text-zinc-300 truncate mb-1">
              {email.subject || '(no subject)'}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full ${statusBadgeClasses(statusConfig.color)}`}
              >
                {statusConfig.label}
              </span>
              {email.body_text && (
                <span className="text-[10px] text-zinc-600 truncate">
                  {email.body_text.slice(0, 60)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
