import { useMemo } from 'react';
import { useCrmStore } from '../../../../stores/crm';
import { useEmailsForContact, useEmailsForDeal, useEmailsForCompany } from '../../../../stores/email';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { TabHeader } from './TabHeader';
import { EMAIL_STATUS_CONFIG } from '../../../../types/email';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_COLORS: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-400',
  yellow: 'bg-yellow-500/20 text-yellow-400',
  blue: 'bg-blue-500/20 text-blue-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  indigo: 'bg-indigo-500/20 text-indigo-400',
};

interface EmailsTabProps {
  entityType: string;
  entityId: string;
  onSendEmail?: () => void;
}

export default function EmailsTab({ entityType, entityId, onSendEmail }: EmailsTabProps) {
  const contacts = useCrmStore(s => s.contacts);

  const companyContactIds = useMemo(
    () => new Set(contacts.filter(c => c.company_id === entityId).map(c => c.id)),
    [contacts, entityId],
  );

  const contactEmails = useEmailsForContact(entityType === 'contact' ? entityId : null);
  const dealEmails = useEmailsForDeal(entityType === 'deal' ? entityId : null);
  const companyEmails = useEmailsForCompany(
    entityType === 'company' ? entityId : null,
    companyContactIds,
  );

  const emails =
    entityType === 'contact' ? contactEmails :
    entityType === 'deal' ? dealEmails :
    companyEmails;

  if (!emails.length) return <ProfileEmptyState message="No emails yet" actionLabel="Send Email" onAction={onSendEmail} />;

  return (
    <div>
      <TabHeader count={emails.length} noun="email" actionLabel="Send Email" onAction={onSendEmail} />
      <div className="space-y-2">
        {emails.map(email => {
          const statusCfg = EMAIL_STATUS_CONFIG[email.status];
          const colorClass = STATUS_COLORS[statusCfg?.color] ?? STATUS_COLORS.zinc;
          const isInbound = email.direction === 'inbound';
          return (
            <div
              key={email.id}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs ${isInbound ? 'text-blue-400' : 'text-amber-400'}`}>
                    {isInbound ? '\u2199' : '\u2197'}
                  </span>
                  <span className="text-sm font-medium text-zinc-200 truncate">
                    {email.subject || '(no subject)'}
                  </span>
                </div>
                <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${colorClass}`}>
                  {statusCfg?.label ?? email.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                {isInbound && email.from_address && (
                  <span className="truncate max-w-[180px]">From: {email.from_address}</span>
                )}
                {!isInbound && email.to_addresses?.[0] && (
                  <span className="truncate max-w-[180px]">To: {email.to_addresses[0]}</span>
                )}
                <span className="ml-auto">{relativeTime(email.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
