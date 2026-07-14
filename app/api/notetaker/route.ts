import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cancelUserSoloMeetingBots } from "@/lib/sync";

/**
 * Master on/off switch for the meeting notetaker (the Recall bot, "Jim").
 *
 * Turning it OFF:
 *  - persists notetakerEnabled=false in the user's dashboard_prefs, which makes
 *    scheduleBotsForUser skip this user in both the cron sync and the calendar
 *    webhook (so no future bots are scheduled), and
 *  - cancels any bot already queued on a meeting where the user is the sole
 *    attendee, so Jim can't join after they've switched it off.
 *
 * Turning it ON just clears the flag; the next sync resumes scheduling.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;

  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = body.enabled !== false; // default to enabled unless explicitly false

  // Merge into dashboard_prefs so we don't clobber the user's other prefs.
  const { data: existing } = await supabase
    .from("users")
    .select("dashboard_prefs")
    .eq("email", email)
    .single();
  const merged = { ...(existing?.dashboard_prefs ?? {}), notetakerEnabled: enabled };

  await supabase.from("users").update({ dashboard_prefs: merged }).eq("email", email);

  if (!enabled) {
    await cancelUserSoloMeetingBots(email);
  }

  return NextResponse.json({ ok: true, enabled });
}
