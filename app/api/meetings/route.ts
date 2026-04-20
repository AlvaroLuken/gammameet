import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserMeetings } from "@/lib/calendar";
import { supabase } from "@/lib/supabase";
import { scheduleBotsForUser } from "@/lib/sync";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.user.accessToken;

  if (accessToken) {
    syncCalendar(session.user.email, accessToken).catch(console.error);
  }

  const { data: invites } = await supabase
    .from("meeting_invites")
    .select("meeting_id")
    .eq("email", session.user.email);

  const ids = (invites ?? []).map((r) => r.meeting_id);
  if (ids.length === 0) return NextResponse.json([]);

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .in("id", ids)
    .not("recall_bot_id", "is", null)
    .order("start_time", { ascending: false });

  // Show completed decks always; show pending/upcoming only within a 6-hour window
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const visible = (meetings ?? []).filter(
    (m) => m.gamma_url !== null || m.start_time > sixHoursAgo
  );

  return NextResponse.json(visible);
}

async function syncCalendar(userEmail: string, accessToken: string) {
  // Sync past meetings for record-keeping
  const pastMeetings = await getUserMeetings(accessToken);
  for (const m of pastMeetings) {
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("calendar_event_id", m.id)
      .single();

    if (!existing) {
      const { data: meeting } = await supabase
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

      if (meeting && m.attendees.length > 0) {
        await supabase.from("meeting_invites").insert(
          m.attendees.map((email) => ({ meeting_id: meeting.id, email }))
        );
      }
    }
  }

  // Schedule bots for upcoming meetings
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (user) {
    await scheduleBotsForUser(user.id, userEmail, accessToken);
  }
}
