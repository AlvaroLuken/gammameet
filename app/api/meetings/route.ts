import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserMeetings } from "@/lib/calendar";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.user.accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 });
  }

  // Sync calendar meetings into DB
  const calendarMeetings = await getUserMeetings(accessToken);

  for (const m of calendarMeetings) {
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

  // Return meetings this user is invited to
  const { data: invites } = await supabase
    .from("meeting_invites")
    .select("meeting_id")
    .eq("email", session.user.email);

  const ids = (invites ?? []).map((r) => r.meeting_id);
  if (ids.length === 0) return NextResponse.json([]);

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .in("id", ids)
    .order("start_time", { ascending: false });

  return NextResponse.json(meetings ?? []);
}
