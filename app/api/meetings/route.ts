import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

  // Return all meetings the user is invited to. Used to require recall_bot_id
  // IS NOT NULL, but ambient recordings (via /record) have no bot by design —
  // they're only scoped by meeting_invites, which is already enforced above.
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .in("id", ids)
    .order("start_time", { ascending: false });

  // Show completed decks always; show pending/upcoming only within a 6-hour window
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const visible = (meetings ?? []).filter(
    (m) => m.gamma_url !== null || m.start_time > sixHoursAgo
  );

  return NextResponse.json(visible);
}

async function syncCalendar(userEmail: string, accessToken: string) {
  // We intentionally do NOT index past calendar events — only upcoming meetings
  // we're scheduling bots for land in the DB. Past events would be noise at
  // best and a privacy concern at worst (meetings the user never chose to
  // record).
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", userEmail)
    .single();

  if (user) {
    await scheduleBotsForUser(user.id, userEmail, accessToken);
  }
}
