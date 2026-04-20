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

  console.log(`Cron sync complete: ${synced} synced, ${failed} failed`);
  return NextResponse.json({ synced, failed });
}
