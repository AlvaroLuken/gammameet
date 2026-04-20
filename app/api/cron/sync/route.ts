import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { refreshGoogleToken, scheduleBotsForUser } from "@/lib/sync";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: users } = await supabase
    .from("users")
    .select("id, email, google_refresh_token")
    .not("google_refresh_token", "is", null);

  if (!users?.length) return NextResponse.json({ synced: 0 });

  let synced = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const accessToken = await refreshGoogleToken(user.google_refresh_token);
      await scheduleBotsForUser(user.id, user.email, accessToken);
      synced++;
    } catch (err) {
      console.error(`Cron sync failed for ${user.email}:`, err);
      failed++;
    }
  }

  // Sweep: mark stale meetings as failed
  // A meeting is "stale" if: bot was scheduled, start_time > 2h ago,
  // no deck generated, and not already marked failed.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: staleMeetings, error: staleErr } = await supabase
    .from("meetings")
    .update({ transcript_error: true })
    .not("recall_bot_id", "is", null)
    .is("gamma_url", null)
    .eq("transcript_error", false)
    .lt("start_time", twoHoursAgo)
    .select("id");

  const staleCount = staleMeetings?.length ?? 0;
  if (staleErr) console.error("Stale sweep failed:", staleErr);
  else if (staleCount > 0) console.log(`Cron sweep: marked ${staleCount} stale meetings as failed`);

  console.log(`Cron sync complete: ${synced} synced, ${failed} failed, ${staleCount} stale`);
  return NextResponse.json({ synced, failed, stale: staleCount });
}
