import { supabase } from "@/lib/supabase";
import { getUpcomingMeetings } from "@/lib/calendar";
import { createBot, deleteBot } from "@/lib/recall";

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
      .select("id, recall_bot_id, start_time, end_time, title, bot_status")
      .eq("calendar_event_id", m.id)
      .single();

    let meetingId: string;
    let shouldCreateBot = false;

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
      shouldCreateBot = true;

      // Always include the syncing user so they can see their own meeting.
      const inviteEmails = [...new Set([userEmail, ...m.attendees].filter(Boolean))];
      if (inviteEmails.length > 0) {
        await supabase.from("meeting_invites").upsert(
          inviteEmails.map((email) => ({ meeting_id: meetingId, email })),
          { onConflict: "meeting_id,email" }
        );
      }
    } else {
      meetingId = existing.id;

      // Sync calendar changes (title/time moves)
      const titleChanged = existing.title !== m.title;
      const timeChanged =
        new Date(existing.start_time).getTime() !== new Date(m.start).getTime() ||
        new Date(existing.end_time).getTime() !== new Date(m.end).getTime();

      if (titleChanged || timeChanged) {
        await supabase
          .from("meetings")
          .update({ title: m.title, start_time: m.start, end_time: m.end })
          .eq("id", meetingId);
      }

      // Decide whether to reschedule the bot:
      // - No bot yet → schedule one
      // - Bot exists, hasn't joined yet, and start moved by > 2 min → cancel + reschedule
      const botHasJoined = existing.bot_status === "recording" || existing.bot_status === "ended";
      const botDidFail = existing.bot_status === "failed";
      const startDriftMin =
        Math.abs(new Date(existing.start_time).getTime() - new Date(m.start).getTime()) / 60000;

      if (!existing.recall_bot_id) {
        shouldCreateBot = true;
      } else if (!botHasJoined && !botDidFail && startDriftMin > 2) {
        // Reschedule: kill old bot, clear status, create new one
        try {
          await deleteBot(existing.recall_bot_id);
        } catch (err) {
          console.error(`Failed to delete stale bot ${existing.recall_bot_id}:`, err);
        }
        await supabase.from("meetings").update({ recall_bot_id: null, bot_status: null }).eq("id", meetingId);
        shouldCreateBot = true;
        console.log(`Rescheduled bot for moved meeting "${m.title}" (${startDriftMin.toFixed(1)}min drift)`);
      } else {
        continue; // bot already scheduled and times are fine, or bot already ran
      }
    }

    if (!shouldCreateBot) continue;

    try {
      const minsUntilStart = (new Date(m.start).getTime() - Date.now()) / 60000;
      const joinAt =
        minsUntilStart > 3
          ? new Date(new Date(m.start).getTime() - 2 * 60 * 1000).toISOString()
          : undefined;

      const botId = await createBot({ meetingUrl: m.meetLink!, joinAt, meetingId });
      await supabase.from("meetings").update({ recall_bot_id: botId, bot_status: "scheduled" }).eq("id", meetingId);
      console.log(`Bot ${botId} scheduled for "${m.title}" (user: ${userEmail})`);
    } catch (err) {
      console.error(`Failed to schedule bot for "${m.title}" (user: ${userEmail}):`, err);
    }
  }
}
