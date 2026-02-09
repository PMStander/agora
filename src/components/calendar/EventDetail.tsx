import { useState } from 'react';
import { useCalendarStore, useSelectedEvent } from '../../stores/calendar';
import { useCalendar } from '../../hooks/useCalendar';
import { EVENT_TYPE_CONFIG, EVENT_STATUS_CONFIG } from '../../types/calendar';
import type { CalendarEventStatus } from '../../types/calendar';
import { getAgent, AGENTS } from '../../types/supabase';

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };
  return map[color] || map.zinc;
}

export function EventDetail() {
  const event = useSelectedEvent();
  const { selectEvent } = useCalendarStore();
  const { updateEventDetails, deleteEvent } = useCalendar();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!event) return null;

  const typeConfig = EVENT_TYPE_CONFIG[event.event_type];
  const statusConfig = EVENT_STATUS_CONFIG[event.status];
  const agent = event.owner_agent_id ? getAgent(event.owner_agent_id) : null;

  const handleStatusChange = (status: CalendarEventStatus) => {
    updateEventDetails(event.id, { status });
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteEvent(event.id);
    selectEvent(null);
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Event Details</h2>
        <button
          onClick={() => selectEvent(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          X
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Title */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full mb-2 ${statusBadgeClasses(typeConfig.color)}`}>
            {typeConfig.icon} {typeConfig.label}
          </div>
          <h3 className="text-lg font-medium text-zinc-100">{event.title}</h3>
        </div>

        {/* Date/Time */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            When
          </h4>
          <div className="text-sm text-zinc-300">
            {formatDateTime(event.start_at, event.all_day)}
          </div>
          {event.end_at && !event.all_day && (
            <div className="text-sm text-zinc-400 mt-0.5">
              to {formatDateTime(event.end_at, false)}
            </div>
          )}
          {event.all_day && (
            <span className="text-xs text-zinc-500 mt-1 inline-block">All day</span>
          )}
        </div>

        {/* Status */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Status
          </h4>
          <div className="flex flex-wrap gap-1">
            {(Object.entries(EVENT_STATUS_CONFIG) as [CalendarEventStatus, { label: string; color: string }][]).map(
              ([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    event.status === key
                      ? statusBadgeClasses(cfg.color)
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {cfg.label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Location & URL */}
        {(event.location || event.meeting_url) && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Location
            </h4>
            {event.location && (
              <div className="text-sm text-zinc-300">{event.location}</div>
            )}
            {event.meeting_url && (
              <a
                href={event.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                Join Meeting
              </a>
            )}
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Description
            </h4>
            <p className="text-sm text-zinc-400 whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Agent */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Owner
          </h4>
          {agent ? (
            <div className="text-sm text-zinc-300">
              {agent.emoji} {agent.name}
              <span className="text-zinc-500 ml-1">({agent.role})</span>
            </div>
          ) : (
            <span className="text-xs text-zinc-600">Unassigned</span>
          )}
        </div>

        {/* Recurrence */}
        {event.recurrence_rule && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Recurrence
            </h4>
            <div className="text-sm text-zinc-400">{event.recurrence_rule}</div>
          </div>
        )}

        {/* Google Calendar link */}
        {event.google_event_id && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Google Calendar
            </h4>
            <span className="text-xs text-zinc-500">Synced: {event.google_event_id}</span>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        {event.status !== 'completed' && event.status !== 'cancelled' && (
          <button
            onClick={() => handleStatusChange('completed')}
            className="w-full px-3 py-2 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
          >
            Mark Completed
          </button>
        )}
        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Event'}
        </button>
      </div>
    </div>
  );
}
