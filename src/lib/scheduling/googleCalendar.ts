import { exchangeCodeForTokens, refreshAccessToken } from '@/lib/google/oauth';

export { exchangeCodeForTokens, refreshAccessToken };

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_CALLBACK_PATH = '/api/scheduling/google/callback';

/** Must match a URI registered in Google Cloud OAuth client "Authorized redirect URIs". */
export function getCalendarOAuthRedirectUri(requestOrigin?: string): string {
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI) {
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  }
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || requestOrigin;
  if (!base) {
    throw new Error('Calendar OAuth redirect URI: set GOOGLE_CALENDAR_REDIRECT_URI or NEXTAUTH_URL');
  }
  return `${base}${CALENDAR_CALLBACK_PATH}`;
}

export function getCalendarOAuthScopes(): string {
  return CALENDAR_SCOPE;
}

export type GoogleCalendarConferenceEntryPoint = {
  entryPointType?: string;
  uri?: string;
  label?: string;
  meetingCode?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
  recurringEventId?: string;
  recurrence?: string[];
  iCalUID?: string;
  attendees?: { email?: string; responseStatus?: string }[];
  conferenceData?: {
    entryPoints?: GoogleCalendarConferenceEntryPoint[];
    createRequest?: {
      requestId?: string;
      status?: { statusCode?: string };
    };
  };
};

function buildGoogleMeetCreateRequest() {
  return {
    requestId: crypto.randomUUID(),
    conferenceSolutionKey: { type: 'hangoutsMeet' },
  };
}

function isConferencePending(event: GoogleCalendarEvent): boolean {
  return event.conferenceData?.createRequest?.status?.statusCode === 'pending';
}

export async function getCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<GoogleCalendarEvent> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  );
  url.searchParams.set('conferenceDataVersion', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Failed to get calendar event');
  }
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasVideoConferenceEntryPoint(event: GoogleCalendarEvent): boolean {
  return !!event.conferenceData?.entryPoints?.some(
    (ep) => ep.entryPointType === 'video' && ep.uri?.trim()
  );
}

/** Poll Google when conference creation is still pending. */
export async function resolveCalendarEventConference(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> {
  if (hasVideoConferenceEntryPoint(event) || !isConferencePending(event)) {
    return event;
  }

  let current = event;
  for (const delayMs of [0, 500]) {
    if (delayMs > 0) await sleep(delayMs);
    current = await getCalendarEvent(accessToken, calendarId, event.id);
    if (hasVideoConferenceEntryPoint(current) || !isConferencePending(current)) {
      return current;
    }
  }
  return current;
}

async function postCalendarEvent(
  accessToken: string,
  calendarId: string,
  body: Record<string, unknown>,
  options: {
    sendUpdates?: 'all' | 'externalOnly' | 'none';
    conferenceDataVersion?: boolean;
  }
): Promise<GoogleCalendarEvent> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  if (options.sendUpdates) {
    url.searchParams.set('sendUpdates', options.sendUpdates);
  }
  if (options.conferenceDataVersion) {
    url.searchParams.set('conferenceDataVersion', '1');
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create calendar event: ${err}`);
  }
  return res.json();
}

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Failed to list calendar events');
  }
  const data = await res.json();
  return (data.items || []) as GoogleCalendarEvent[];
}

export async function insertCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    start: string;
    end: string;
    timeZone: string;
    recurrence?: string[];
    attendees?: { email: string }[];
    sendUpdates?: 'all' | 'externalOnly' | 'none';
    addGoogleMeet?: boolean;
  }
): Promise<GoogleCalendarEvent> {
  const sendUpdates =
    event.sendUpdates ?? (event.attendees?.length ? 'all' : undefined);
  const addGoogleMeet = event.addGoogleMeet === true;

  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start, timeZone: event.timeZone },
    end: { dateTime: event.end, timeZone: event.timeZone },
  };
  if (event.location) {
    body.location = event.location;
  }
  if (event.recurrence?.length) {
    body.recurrence = event.recurrence;
  }
  if (event.attendees?.length) {
    body.attendees = event.attendees;
  }
  if (addGoogleMeet) {
    body.conferenceData = { createRequest: buildGoogleMeetCreateRequest() };
  }

  try {
    const created = await postCalendarEvent(accessToken, calendarId, body, {
      sendUpdates,
      conferenceDataVersion: addGoogleMeet,
    });
    if (!addGoogleMeet) return created;
    return resolveCalendarEventConference(accessToken, calendarId, created);
  } catch (error) {
    // Some calendars/accounts cannot create Meet links; still create the event.
    if (!addGoogleMeet) throw error;
    console.warn('Google Meet conference creation failed; creating event without Meet link.', error);
    const bodyWithoutMeet = { ...body };
    delete bodyWithoutMeet.conferenceData;
    return postCalendarEvent(accessToken, calendarId, bodyWithoutMeet, { sendUpdates });
  }
}

export async function patchCalendarEventDescription(
  accessToken: string,
  calendarId: string,
  eventId: string,
  description: string
): Promise<void> {
  await updateCalendarEvent(accessToken, calendarId, eventId, { description });
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    summary?: string;
    description?: string;
    location?: string | null;
    start?: string;
    end?: string;
    timeZone?: string;
    attendees?: { email: string }[];
    sendUpdates?: 'all' | 'externalOnly' | 'none';
    addGoogleMeet?: boolean;
    recurrence?: string[];
  }
): Promise<GoogleCalendarEvent> {
  const body: Record<string, unknown> = {};
  if (event.summary !== undefined) body.summary = event.summary;
  if (event.description !== undefined) body.description = event.description;
  if (event.location !== undefined) body.location = event.location || '';
  if (event.start && event.timeZone) {
    body.start = { dateTime: event.start, timeZone: event.timeZone };
  }
  if (event.end && event.timeZone) {
    body.end = { dateTime: event.end, timeZone: event.timeZone };
  }
  if (event.attendees !== undefined) {
    body.attendees = event.attendees;
  }
  if (event.recurrence !== undefined) {
    body.recurrence = event.recurrence;
  }
  const addGoogleMeet = event.addGoogleMeet === true;
  if (addGoogleMeet) {
    body.conferenceData = { createRequest: buildGoogleMeetCreateRequest() };
  }

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  );
  if (event.sendUpdates) {
    url.searchParams.set('sendUpdates', event.sendUpdates);
  }
  if (addGoogleMeet) {
    url.searchParams.set('conferenceDataVersion', '1');
  }

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update calendar event: ${err}`);
  }

  let updated = (await res.json()) as GoogleCalendarEvent;
  if (addGoogleMeet) {
    updated = await resolveCalendarEventConference(accessToken, calendarId, updated);
  }
  return updated;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  options?: { sendUpdates?: 'all' | 'externalOnly' | 'none' }
): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  );
  if (options?.sendUpdates) {
    url.searchParams.set('sendUpdates', options.sendUpdates);
  }

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error('Failed to delete calendar event');
  }
}

export function parseEventTimes(event: GoogleCalendarEvent): { start: Date; end: Date } | null {
  const startRaw = event.start?.dateTime || event.start?.date;
  const endRaw = event.end?.dateTime || event.end?.date;
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}
