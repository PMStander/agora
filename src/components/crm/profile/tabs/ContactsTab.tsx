import { useCrmStore, useContactsByCompany } from '../../../../stores/crm';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { TabHeader } from './TabHeader';
import { LIFECYCLE_STATUS_CONFIG, LEAD_SCORE_CONFIG } from '../../../../types/crm';

const STATUS_COLORS: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-400',
  blue: 'bg-blue-500/20 text-blue-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
  indigo: 'bg-indigo-500/20 text-indigo-400',
  amber: 'bg-amber-500/20 text-amber-400',
  green: 'bg-green-500/20 text-green-400',
  purple: 'bg-purple-500/20 text-purple-400',
  red: 'bg-red-500/20 text-red-400',
};

interface ContactsTabProps {
  entityType: string;
  entityId: string;
  onAddContact?: () => void;
}

export default function ContactsTab({ entityType, entityId, onAddContact }: ContactsTabProps) {
  void entityType; // only used for company
  const navigateToProfile = useCrmStore(s => s.navigateToProfile);
  const contacts = useContactsByCompany(entityId);

  if (!contacts.length) return <ProfileEmptyState message="No contacts yet" actionLabel="Add Contact" onAction={onAddContact} />;

  return (
    <div>
      <TabHeader count={contacts.length} noun="contact" actionLabel="Add Contact" onAction={onAddContact} />
      <div className="space-y-2">
        {contacts.map(contact => {
          const fullName = `${contact.first_name} ${contact.last_name}`.trim();
          const lifecycleCfg = LIFECYCLE_STATUS_CONFIG[contact.lifecycle_status];
          const lifecycleColor = STATUS_COLORS[lifecycleCfg?.color] ?? STATUS_COLORS.zinc;
          const scoreCfg = LEAD_SCORE_CONFIG[contact.lead_score_label];

          return (
            <div
              key={contact.id}
              onClick={() => navigateToProfile('contact', contact.id, fullName)}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-200 truncate">{fullName}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded ${lifecycleColor}`}>
                  {lifecycleCfg?.label ?? contact.lifecycle_status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                {contact.email && <span className="truncate max-w-[180px]">{contact.email}</span>}
                {contact.phone && <span>{contact.phone}</span>}
                {contact.job_title && <span>{contact.job_title}</span>}
                <span className="ml-auto">
                  Score: <span className={scoreCfg?.textClass ?? 'text-zinc-400'}>{contact.lead_score}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
