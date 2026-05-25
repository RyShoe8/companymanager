const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
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

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ refresh_token?: string; access_token: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth not configured');
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to refresh Google access token');
  }
  const data = await res.json();
  return data.access_token as string;
}

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
  recurringEventId?: string;
  iCalUID?: string;
  attendees?: { email?: string; responseStatus?: string }[];
};

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
    start: string;
    end: string;
    timeZone: string;
    recurrence?: string[];
    attendees?: { email: string }[];
    sendUpdates?: 'all' | 'externalOnly' | 'none';
  }
): Promise<GoogleCalendarEvent> {
  let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const sendUpdates =
    event.sendUpdates ?? (event.attendees?.length ? 'all' : undefined);
  if (sendUpdates) {
    url += `?sendUpdates=${encodeURIComponent(sendUpdates)}`;
  }
  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    start: { dateTime: event.start, timeZone: event.timeZone },
    end: { dateTime: event.end, timeZone: event.timeZone },
  };
  if (event.recurrence?.length) {
    body.recurrence = event.recurrence;
  }
  if (event.attendees?.length) {
    body.attendees = event.attendees;
  }
  const res = await fetch(url, {
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

export async function patchCalendarEventDescription(
  accessToken: string,
  calendarId: string,
  eventId: string,
  description: string
): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    throw new Error('Failed to update calendar event');
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
