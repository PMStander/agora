import { useState } from 'react';
import { useCalendar } from '../../hooks/useCalendar';
import { useCalendarStore } from '../../stores/calendar';
import { useCrmStore } from '../../stores/crm';
import { AGENTS } from '../../types/supabase';
import { EVENT_TYPE_CONFIG, RECURRENCE_OPTIONS } from '../../types/calendar';
import type { CalendarEventType } from '../../types/calendar';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillContactId?: string;
  prefillDealId?: string;
  prefillCompanyId?: string;
  prefillProjectId?: string;
  prefillStartAt?: string;
}

export function CreateEventModal({
  isOpen,
  onClose,
  prefillContactId,
  prefillDealId,
  prefillCompanyId,
  prefillProjectId,
  prefillStartAt,
}: CreateEventModalProps) {
  const { createEvent } = useCalendar();
  const prefill = useCalendarStore((s) => s.createModalPrefill);
  const contacts = useCrmStore((s) => s.contacts);
  const deals = useCrmStore((s) => s.deals);

  // Use prefill from store or from props
  const effectiveContactId = prefillContactId || prefill?.contact_id || '';
  const effectiveDealId = prefillDealId || prefill?.deal_id || '';
  const effectiveCompanyId = prefillCompanyId || prefill?.company_id || '';

  const defaultStart = prefillStartAt || prefill?.start_at || getDefaultStart();

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('meeting');
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(getDefaultEnd(defaultStart));
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [description, setDescription] = useState('');
  const [contactId, setContactId] = useState(effectiveContactId);
  const [dealId, setDealId] = useState(effectiveDealId);
  const [ownerAgentId, setOwnerAgentId] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startAt) return;

    setSaving(true);
    await createEvent({
      title: title.trim(),
      description: description.trim() || undefined,
      event_type: eventType,
      start_at: new Date(startAt).toISOString(),
      end_at: endAt ? new Date(endAt).toISOString() : undefined,
      all_day: allDay,
      location: location.trim() || undefined,
      meeting_url: meetingUrl.trim() || undefined,
      contact_id: contactId || undefined,
      company_id: effectiveCompanyId || undefined,
      deal_id: dealId || undefined,
      project_id: prefillProjectId || prefill?.project_id || undefined,
      owner_agent_id: ownerAgentId || undefined,
      recurrence_rule: recurrence || undefined,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">Create Event</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              X
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting with..."
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>

            {/* Event Type */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Type</label>
              <div className="flex flex-wrap gap-1">
                {(Object.entries(EVENT_TYPE_CONFIG) as [CalendarEventType, { label: string; icon: string }][]).map(
                  ([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEventType(key)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        eventType === key
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Start *</label>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? startAt.slice(0, 10) : startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">End</label>
                <input
                  type={allDay ? 'date' : 'datetime-local'}
                  value={allDay ? endAt.slice(0, 10) : endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* All-day toggle */}
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded border-zinc-600"
              />
              All day event
            </label>

            {/* Location & Meeting URL */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Office, Room 4..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Meeting URL</label>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Event details..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none"
              />
            </div>

            {/* Contact */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Contact</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
              >
                <option value="">None</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Deal */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Deal</label>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
              >
                <option value="">None</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Owner Agent</label>
              <select
                value={ownerAgentId}
                onChange={(e) => setOwnerAgentId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {AGENTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recurrence */}
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none"
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDefaultStart(): string {
  const d = new Date();
  d.setMinutes(0);
  d.setSeconds(0);
  d.setHours(d.getHours() + 1);
  return toLocalDateTimeString(d);
}

function getDefaultEnd(startStr: string): string {
  const d = new Date(startStr);
  d.setHours(d.getHours() + 1);
  return toLocalDateTimeString(d);
}

function toLocalDateTimeString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}
