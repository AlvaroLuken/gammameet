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
      meetLink: e.hangoutLink ?? undefined,
    }));
}

export async function getUserMeetings(accessToken: string): Promise<CalendarMeeting[]> {
  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);
  return listEvents(accessToken, threeMonthsAgo.toISOString(), now.toISOString());
}

export async function getUpcomingMeetings(accessToken: string): Promise<CalendarMeeting[]> {
  // Include meetings that started up to 30 min ago so we can still schedule
  // a bot for in-progress meetings (e.g., if a meeting was created with no
  // lead time and our sync ran right after it started).
  const lookback = new Date(Date.now() - 30 * 60 * 1000);
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  return listEvents(accessToken, lookback.toISOString(), sevenDaysOut.toISOString());
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
