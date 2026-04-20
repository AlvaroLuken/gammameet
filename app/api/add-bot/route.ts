import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createBot } from "@/lib/recall";
import { getCalendarEventForMeetLink } from "@/lib/calendar";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingUrl, title } = await req.json();
  if (!meetingUrl) {
    return NextResponse.json({ error: "meetingUrl is required" }, { status: 400 });
  }

  // Rate limit: max 10 manual bot adds per user per hour.
  // Count meetings linked to this user's invites within the last hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("meetings")
    .select("id, meeting_invites!inner(email)", { count: "exact", head: true })
    .eq("meeting_invites.email", session.user.email)
    .not("recall_bot_id", "is", null)
    .gte("created_at", oneHourAgo);
  if ((recentCount ?? 0) >= 10) {
    return NextResponse.json(
      { error: "Rate limit reached: 10 manual bot adds per hour. Try again later." },
      { status: 429 }
    );
  }

  // Ensure user exists in DB (may not be there if upsert failed during OAuth)
  await supabase.from("users").upsert(
    { email: session.user.email, name: session.user.name, image: session.user.image },
    { onConflict: "email" }
  );

  // Dedup: if a meeting for this meet_link already has an active/scheduled bot
  // within a 4-hour window, reuse it — don't create a second bot.
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("meetings")
    .select("id, recall_bot_id, bot_status, gamma_url")
    .eq("meet_link", meetingUrl)
    .gte("start_time", fourHoursAgo)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.recall_bot_id && existing.bot_status !== "failed" && !existing.gamma_url) {
    // Make sure the user is an invitee so they see it on the dashboard
    await supabase.from("meeting_invites").upsert(
      [{ meeting_id: existing.id, email: session.user.email }],
      { onConflict: "meeting_id,email" }
    );
    return NextResponse.json({ ok: true, botId: existing.recall_bot_id, alreadyScheduled: true, meetingId: existing.id });
  }

  let meetingId: string;

  if (existing && !existing.recall_bot_id) {
    // Meeting exists (from calendar sync) but no bot yet — attach bot to it
    meetingId = existing.id;
  } else {
    const { data: created } = await supabase
      .from("meetings")
      .insert({
        title: title || "Ad-hoc Meeting",
        start_time: new Date().toISOString(),
        meet_link: meetingUrl,
      })
      .select()
      .single();
    if (!created) return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
    meetingId = created.id;
  }

  // Pull title + attendees from Google Calendar
  const calendarEvent = session.user.accessToken
    ? await getCalendarEventForMeetLink(session.user.accessToken, meetingUrl).catch(() => ({ attendees: [], title: null }))
    : { attendees: [], title: null };

  const resolvedTitle = title || calendarEvent.title || "Ad-hoc Meeting";
  await supabase.from("meetings").update({ title: resolvedTitle }).eq("id", meetingId);

  const allEmails = [...new Set([session.user.email, ...calendarEvent.attendees])].filter(Boolean);
  await supabase.from("meeting_invites").upsert(
    allEmails.map((email) => ({ meeting_id: meetingId, email })),
    { onConflict: "meeting_id,email" }
  );

  try {
    const botId = await createBot({ meetingUrl, meetingId });
    await supabase.from("meetings").update({ recall_bot_id: botId, bot_status: "scheduled" }).eq("id", meetingId);
    return NextResponse.json({ ok: true, botId, meetingId });
  } catch (err) {
    return NextResponse.json({ error: `Recall error: ${String(err)}` }, { status: 500 });
  }
}
