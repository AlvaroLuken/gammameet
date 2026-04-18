import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserMeetings } from "@/lib/calendar";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch calendar meetings
  const calendarMeetings = await getUserMeetings(session.user.id);

  // Upsert calendar meetings into DB
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

  // Fetch meetings this user is invited to
  const userEmail = session.user.email!;
  const { data: invitedMeetingIds } = await supabase
    .from("meeting_invites")
    .select("meeting_id")
    .eq("email", userEmail);

  const ids = (invitedMeetingIds ?? []).map((r) => r.meeting_id);

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .in("id", ids)
    .order("start_time", { ascending: false });

  return NextResponse.json(meetings ?? []);
}
