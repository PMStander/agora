/**
 * Google Calendar API integration.
 *
 * Shares the same Google OAuth2 infrastructure as the Gmail / email module.
 * When both modules are active, a single OAuth2 consent screen can request
 * all scopes at once:
 *
 * Required scopes for calendar:
 *   - https://www.googleapis.com/auth/calendar.events
 *   - https://www.googleapis.com/auth/calendar.readonly
 *
 * Required scopes for gmail (email module):
 *   - https://www.googleapis.com/auth/gmail.send
 *   - https://www.googleapis.com/auth/gmail.readonly
 *
 * Auth tokens should be stored server-side (e.g. in a google_auth_tokens
 * table or reused from email_accounts). The client never handles refresh
 * tokens directly -- it calls gateway RPC endpoints that proxy to Google
 * APIs with valid access tokens.
 *
 * For now, these functions accept an accessToken parameter and call the
 * Google Calendar REST API directly. In production, replace with gateway
 * RPC calls that handle token refresh.
 */

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  conferenceData?: Record<string, unknown>;
  recurrence?: string[];
  reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
  status?: string;
  htmlLink?: string;
}

export interface GoogleSyncResult {
  events: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

// ─── API Functions ──────────────────────────────────────────────────────────

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    console.error('[GoogleCalendar] List events failed:', res.status);
    return [];
  }

  const data = await res.json();
  return data.items ?? [];
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: Omit<GoogleCalendarEvent, 'id'>
): Promise<GoogleCalendarEvent | null> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    console.error('[GoogleCalendar] Create event failed:', res.status);
    return null;
  }

  return res.json();
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: Partial<GoogleCalendarEvent>
): Promise<GoogleCalendarEvent | null> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );

  if (!res.ok) {
    console.error('[GoogleCalendar] Update event failed:', res.status);
    return null;
  }

  return res.json();
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    console.error('[GoogleCalendar] Delete event failed:', res.status);
    return false;
  }

  return true;
}

export async function syncCalendarEvents(
  accessToken: string,
  calendarId: string,
  syncToken?: string
): Promise<GoogleSyncResult> {
  const params = new URLSearchParams({ maxResults: '250' });
  if (syncToken) {
    params.set('syncToken', syncToken);
  } else {
    params.set('timeMin', new Date().toISOString());
  }

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    console.error('[GoogleCalendar] Sync failed:', res.status);
    return { events: [] };
  }

  const data = await res.json();
  return {
    events: data.items ?? [],
    nextSyncToken: data.nextSyncToken,
    nextPageToken: data.nextPageToken,
  };
}
