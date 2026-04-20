import { supabase } from "@/lib/supabase";
import { getUpcomingMeetings } from "@/lib/calendar";
import { createBot } from "@/lib/recall";

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed: ${data.error}`);
  return data.access_token as string;
}

export async function scheduleBotsForUser(userId: string, userEmail: string, accessToken: string) {
  if (!process.env.RECALLAI_API_KEY) return;

  const upcoming = await getUpcomingMeetings(accessToken);
  const withLinks = upcoming.filter((m) => m.meetLink);

  for (const m of withLinks) {
    const { data: existing } = await supabase
      .from("meetings")
      .select("id, recall_bot_id")
      .eq("calendar_event_id", m.id)
      .single();

    let meetingId: string;

    if (!existing) {
      const { data: created } = await supabase
        .from("meetings")
        .insert({
          calendar_event_id: m.id,
          title: m.title,
          start_time: m.start,
          end_time: m.end,
          meet_link: m.meetLink,
        })
        .select()
        .single();

      if (!created) continue;
      meetingId = created.id;

      if (m.attendees.length > 0) {
        await supabase.from("meeting_invites").upsert(
          m.attendees.map((email) => ({ meeting_id: meetingId, email })),
          { onConflict: "meeting_id,email" }
        );
      }
    } else {
      if (existing.recall_bot_id) continue; // already scheduled
      meetingId = existing.id;
    }

    try {
      // If meeting starts in < 3 minutes, join immediately (no join_at)
      const minsUntilStart = (new Date(m.start).getTime() - Date.now()) / 60000;
      const joinAt =
        minsUntilStart > 3
          ? new Date(new Date(m.start).getTime() - 2 * 60 * 1000).toISOString()
          : undefined;

      const botId = await createBot({ meetingUrl: m.meetLink!, joinAt, meetingId });
      await supabase.from("meetings").update({ recall_bot_id: botId }).eq("id", meetingId);
      console.log(`Bot ${botId} scheduled for "${m.title}" (user: ${userEmail})`);
    } catch (err) {
      console.error(`Failed to schedule bot for "${m.title}" (user: ${userEmail}):`, err);
    }
  }
}
