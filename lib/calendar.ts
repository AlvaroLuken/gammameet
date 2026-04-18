import { google } from "googleapis";
import { supabase } from "./supabase";

export interface CalendarMeeting {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  meetLink?: string;
  description?: string;
}

async function getAccessToken(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("accounts")
    .select("access_token, refresh_token")
    .eq("userId", userId)
    .eq("provider", "google")
    .single();

  if (error || !data) throw new Error("No Google account linked");

  return data.access_token;
}

export async function getUserMeetings(userId: string): Promise<CalendarMeeting[]> {
  const accessToken = await getAccessToken(userId);

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

  const events = res.data.items ?? [];

  return events
    .filter((e) => e.start?.dateTime) // only timed events, not all-day
    .map((e) => ({
      id: e.id!,
      title: e.summary ?? "Untitled Meeting",
      start: e.start!.dateTime!,
      end: e.end!.dateTime!,
      attendees: (e.attendees ?? []).map((a) => a.email!).filter(Boolean),
      meetLink: e.hangoutLink ?? undefined,
      description: e.description ?? undefined,
    }));
}
