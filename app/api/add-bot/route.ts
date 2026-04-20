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

  // Ensure user exists in DB (may not be there if upsert failed during OAuth)
  await supabase.from("users").upsert(
    { email: session.user.email, name: session.user.name, image: session.user.image },
    { onConflict: "email" }
  );

  // Create meeting record
  const { data: meeting } = await supabase
    .from("meetings")
    .insert({
      title: title || "Ad-hoc Meeting",
      start_time: new Date().toISOString(),
      meet_link: meetingUrl,
    })
    .select()
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
  }

  // Pull title + attendees from Google Calendar
  const calendarEvent = session.user.accessToken
    ? await getCalendarEventForMeetLink(session.user.accessToken, meetingUrl).catch(() => ({ attendees: [], title: null }))
    : { attendees: [], title: null };

  const resolvedTitle = title || calendarEvent.title || "Ad-hoc Meeting";
  if (resolvedTitle !== meeting.title) {
    await supabase.from("meetings").update({ title: resolvedTitle }).eq("id", meeting.id);
  }

  const allEmails = [...new Set([session.user.email, ...calendarEvent.attendees])].filter(Boolean);
  await supabase.from("meeting_invites").upsert(
    allEmails.map((email) => ({ meeting_id: meeting.id, email })),
    { onConflict: "meeting_id,email" }
  );

  // Deploy bot immediately (no join_at — join ASAP)
  try {
    const botId = await createBot({ meetingUrl, meetingId: meeting.id });
    await supabase.from("meetings").update({ recall_bot_id: botId }).eq("id", meeting.id);
    return NextResponse.json({ ok: true, botId });
  } catch (err) {
    return NextResponse.json({ error: `Recall error: ${String(err)}` }, { status: 500 });
  }
}
