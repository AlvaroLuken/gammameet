import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { refreshGoogleToken, scheduleBotsForUser } from "@/lib/sync";

export async function POST(req: NextRequest) {
  const state = req.headers.get("x-goog-resource-state");
  const userId = req.headers.get("x-goog-channel-token");

  // Initial handshake — just acknowledge
  if (state === "sync" || !userId) {
    return NextResponse.json({ ok: true });
  }

  const { data: user } = await supabase
    .from("users")
    .select("id, email, google_refresh_token")
    .eq("id", userId)
    .single();

  if (!user?.google_refresh_token) {
    return NextResponse.json({ ok: true });
  }

  try {
    const accessToken = await refreshGoogleToken(user.google_refresh_token);
    await scheduleBotsForUser(user.id, user.email, accessToken);
    console.log(`Calendar webhook: synced bots for ${user.email}`);
  } catch (err) {
    console.error(`Calendar webhook failed for user ${userId}:`, err);
  }

  return NextResponse.json({ ok: true });
}
