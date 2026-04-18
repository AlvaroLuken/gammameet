import { google } from "googleapis";

export interface CalendarMeeting {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  meetLink?: string;
}

export async function getUserMeetings(accessToken: string): Promise<CalendarMeeting[]> {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: threeMonthsAgo.toISOString(),
    timeMax: now.toISOString(),
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
