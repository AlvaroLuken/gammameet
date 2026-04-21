import { supabase } from "@/lib/supabase";
import { getUpcomingMeetings, subscribeToCalendar, stopCalendarWatch } from "@/lib/calendar";
import { createBot, deleteBot } from "@/lib/recall";

export class RefreshTokenInvalidError extends Error {
  constructor() { super("google_refresh_token_invalid"); }
}

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
  if (!res.ok) {
    // invalid_grant means the refresh token has been revoked / expired (common
    // for unverified apps after 7 days). Signal upstream so we can prompt reauth.
    if (data.error === "invalid_grant") throw new RefreshTokenInvalidError();
    throw new Error(`Google token refresh failed: ${data.error}`);
  }
  return data.access_token as string;
}

export async function ensureCalendarSubscription(userId: string, accessToken: string) {
  const { data: user } = await supabase
    .from("users")
    .select("cal_channel_id, cal_resource_id, cal_expiry")
    .eq("id", userId)
    .single();

  // Already subscribed and not expiring within 24h → leave it alone
  const expiresAt = user?.cal_expiry ? Number(user.cal_expiry) : 0;
  if (user?.cal_channel_id && expiresAt > Date.now() + 24 * 60 * 60 * 1000) return;

  // Stop the old channel if there is one
  if (user?.cal_channel_id && user?.cal_resource_id) {
    await stopCalendarWatch(accessToken, user.cal_channel_id, user.cal_resource_id).catch(() => {});
  }

  try {
    const sub = await subscribeToCalendar(accessToken, userId);
    await supabase
      .from("users")
      .update({
        cal_channel_id: sub.channelId,
        cal_resource_id: sub.resourceId,
        cal_expiry: sub.expiry,
      })
      .eq("id", userId);
    console.log(`Calendar push subscription renewed for user ${userId}, expires ${new Date(sub.expiry).toISOString()}`);
  } catch (err) {
    console.warn(`Failed to subscribe to calendar for user ${userId}:`, err);
  }
}

export async function scheduleBotsForUser(userId: string, userEmail: string, accessToken: string) {
  if (!process.env.RECALLAI_API_KEY) return;

  // Make sure we're subscribed to real-time calendar push notifications
  // so new/moved events trigger a near-instant sync
  await ensureCalendarSubscription(userId, accessToken);

  const upcoming = await getUpcomingMeetings(accessToken);
  // Only meetings with a Meet link that haven't already ended
  const now = Date.now();
  const withLinks = upcoming.filter((m) => m.meetLink && new Date(m.end).getTime() > now);

  for (const m of withLinks) {
    // First try by calendar_event_id. If not found, fall back to meet_link
    // within a reasonable window — catches meetings created via /add-bot
    // for the same physical call, preventing duplicate bots.
    let existing: {
      id: string;
      recall_bot_id: string | null;
      start_time: string;
      end_time: string | null;
      title: string;
      bot_status: string | null;
      calendar_event_id?: string | null;
    } | null = null;

    const { data: byEventId } = await supabase
      .from("meetings")
      .select("id, recall_bot_id, start_time, end_time, title, bot_status, calendar_event_id")
      .eq("calendar_event_id", m.id)
      .maybeSingle();
    existing = byEventId;

    if (!existing) {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: byLink } = await supabase
        .from("meetings")
        .select("id, recall_bot_id, start_time, end_time, title, bot_status, calendar_event_id")
        .eq("meet_link", m.meetLink)
        .gte("start_time", fourHoursAgo)
        .is("calendar_event_id", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = byLink;
      if (existing) {
        // Claim this ad-hoc meeting as the calendar one
        await supabase.from("meetings").update({ calendar_event_id: m.id }).eq("id", existing.id);
      }
    }

    let meetingId: string;
    let shouldCreateBot = false;

    if (!existing) {
      const { data: created, error: insertErr } = await supabase
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

      // Race: another worker inserted the same calendar_event_id first. Re-fetch.
      if (insertErr && insertErr.code === "23505") {
        const { data: refetched } = await supabase
          .from("meetings")
          .select("id, recall_bot_id, start_time, end_time, title, bot_status, calendar_event_id")
          .eq("calendar_event_id", m.id)
          .maybeSingle();
        if (!refetched) continue;
        existing = refetched;
        meetingId = refetched.id;
        shouldCreateBot = !refetched.recall_bot_id;
      } else {
        if (!created) continue;
        meetingId = created.id;
        shouldCreateBot = true;
      }

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
      const prevEnd = existing.end_time ? new Date(existing.end_time).getTime() : null;
      const timeChanged =
        new Date(existing.start_time).getTime() !== new Date(m.start).getTime() ||
        prevEnd !== new Date(m.end).getTime();

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

    // Atomic claim: flip bot_status from null → "claiming" in a single UPDATE.
    // The row-level lock ensures only one worker succeeds; all parallel callers
    // that arrive during the createBot call (~2-5s) see bot_status already
    // set and skip.
    const { data: claim } = await supabase
      .from("meetings")
      .update({ bot_status: "claiming" })
      .eq("id", meetingId)
      .is("recall_bot_id", null)
      .is("bot_status", null)
      .select("id")
      .maybeSingle();

    if (!claim) {
      console.log(`Bot creation skipped for "${m.title}" — already claimed by another worker`);
      continue;
    }

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
      // Release the claim on failure so a later run can retry
      await supabase.from("meetings").update({ bot_status: null }).eq("id", meetingId);
      console.error(`Failed to schedule bot for "${m.title}" (user: ${userEmail}):`, err);
    }
  }
}
