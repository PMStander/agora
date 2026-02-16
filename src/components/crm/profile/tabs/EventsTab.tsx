import { useMemo } from 'react';
import { useCrmStore } from '../../../../stores/crm';
import { useEventsForContact, useEventsForDeal, useEventsForCompany } from '../../../../stores/calendar';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { TabHeader } from './TabHeader';
import { EVENT_TYPE_CONFIG } from '../../../../types/calendar';

const TYPE_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  amber: 'bg-amber-500/20 text-amber-400',
  purple: 'bg-purple-500/20 text-purple-400',
  red: 'bg-red-500/20 text-red-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
  zinc: 'bg-zinc-500/20 text-zinc-400',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface EventsTabProps {
  entityType: string;
  entityId: string;
  onScheduleEvent?: () => void;
}

export default function EventsTab({ entityType, entityId, onScheduleEvent }: EventsTabProps) {
  const contacts = useCrmStore(s => s.contacts);

  const companyContactIds = useMemo(
    () => new Set(contacts.filter(c => c.company_id === entityId).map(c => c.id)),
    [contacts, entityId],
  );

  const contactEvents = useEventsForContact(entityType === 'contact' ? entityId : null);
  const dealEvents = useEventsForDeal(entityType === 'deal' ? entityId : null);
  const companyEvents = useEventsForCompany(
    entityType === 'company' ? entityId : null,
    companyContactIds,
  );

  const events =
    entityType === 'contact' ? contactEvents :
    entityType === 'deal' ? dealEvents :
    companyEvents;

  if (!events.length) return <ProfileEmptyState message="No events yet" actionLabel="Schedule Event" onAction={onScheduleEvent} />;

  return (
    <div>
      <TabHeader count={events.length} noun="event" actionLabel="Schedule Event" onAction={onScheduleEvent} />
      <div className="space-y-2">
        {events.map(event => {
          const typeCfg = EVENT_TYPE_CONFIG[event.event_type];
          const colorClass = TYPE_COLORS[typeCfg?.color] ?? TYPE_COLORS.zinc;
          return (
            <div
              key={event.id}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-200 truncate">{event.title}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${colorClass}`}>
                  {typeCfg?.label ?? event.event_type}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{formatDateTime(event.start_at)}</span>
                {event.end_at && <span>- {formatDateTime(event.end_at)}</span>}
                {event.location && (
                  <span className="truncate max-w-[160px]">{event.location}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
