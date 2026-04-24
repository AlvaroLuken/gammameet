import { google } from "googleapis";

const APP_URL = process.env.APP_URL ?? "https://gammameet.vercel.app";

export interface CalendarMeeting {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  meetLink?: string;
}

// Match Zoom meeting URLs in any vanity subdomain (e.g. zoom.us, my.zoom.us, company.zoom.us).
// Covers /j/ (meetings) and /w/ (webinars).
const ZOOM_URL_RE = /https?:\/\/[a-z0-9-]+\.zoom\.us\/(?:j|w|my)\/[^\s"'<>)]+/i;

/**
 * Resolve the conference URL for a calendar event.
 * Priority: Google Meet (hangoutLink) → Zoom (found in conferenceData, location, or description).
 */
function extractConferenceLink(e: {
  hangoutLink?: string | null;
  conferenceData?: { entryPoints?: Array<{ uri?: string | null; entryPointType?: string | null }> | null } | null;
  location?: string | null;
  description?: string | null;
}): string | undefined {
  if (e.hangoutLink) return e.hangoutLink;

  // Structured conference data (when Zoom is added via Calendar add-on)
  for (const ep of e.conferenceData?.entryPoints ?? []) {
    if (ep?.uri && ZOOM_URL_RE.test(ep.uri)) return ep.uri;
  }

  // Plain text fields — Zoom links are commonly pasted here
  const candidates = [e.location, e.description].filter(Boolean) as string[];
  for (const text of candidates) {
    const match = text.match(ZOOM_URL_RE);
    if (match) return match[0];
  }

  return undefined;
}

async function listEvents(accessToken: string, timeMin: string, timeMax: string): Promise<CalendarMeeting[]> {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  return (res.data.items ?? [])
    .filter((e) => e.start?.dateTime)
    .map((e) => ({
      id: e.id!,
      title: e.summary ?? "Untitled Meeting",
      start: e.start!.dateTime!,
      end: e.end!.dateTime!,
      attendees: (e.attendees ?? []).map((a) => a.email!).filter(Boolean),
      meetLink: extractConferenceLink(e),
    }));
}

export async function getUpcomingMeetings(accessToken: string): Promise<CalendarMeeting[]> {
  // 2-day lookahead (was 7). Users with packed calendars shouldn't have 50
  // bots scheduled ahead of time; we keep the pipeline tight and re-scan often.
  const lookback = new Date(Date.now() - 30 * 60 * 1000);
  const twoDaysOut = new Date();
  twoDaysOut.setDate(twoDaysOut.getDate() + 2);
  return listEvents(accessToken, lookback.toISOString(), twoDaysOut.toISOString());
}

export interface CalendarWatchResult {
  channelId: string;
  resourceId: string;
  expiry: number; // ms timestamp
}

export async function subscribeToCalendar(accessToken: string, userId: string): Promise<CalendarWatchResult> {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const channelId = `gm-${userId}-${Date.now()}`;
  const res = await calendar.events.watch({
    calendarId: "primary",
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${APP_URL}/api/webhook/calendar`,
      token: userId,
    },
  });

  return {
    channelId: res.data.id!,
    resourceId: res.data.resourceId!,
    expiry: parseInt(res.data.expiration!),
  };
}

export async function stopCalendarWatch(accessToken: string, channelId: string, resourceId: string): Promise<void> {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.channels.stop({ requestBody: { id: channelId, resourceId } }).catch(() => {});
}

export interface CalendarEventInfo {
  attendees: string[];
  title: string | null;
}

export async function getCalendarEventForMeetLink(accessToken: string, meetLink: string): Promise<CalendarEventInfo> {
  const from = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const to = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const events = await listEvents(accessToken, from.toISOString(), to.toISOString());

  const normalize = (url: string) => url.split("?")[0].replace(/\/$/, "").toLowerCase();
  const normalizedTarget = normalize(meetLink);

  const match = events.find((e) => e.meetLink && normalize(e.meetLink) === normalizedTarget);
  return { attendees: match?.attendees ?? [], title: match?.title ?? null };
}
