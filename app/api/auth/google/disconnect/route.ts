import { NextResponse } from "next/server";
import { auth, revokeGoogleGrant } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { refreshGoogleToken, RefreshTokenInvalidError, cancelUserSoloMeetingBots } from "@/lib/sync";
import { stopCalendarWatch } from "@/lib/calendar";

/**
 * Disconnect the Google Calendar integration for the current user:
 *  - stop Google's calendar push-notification watch channel,
 *  - cancel any scheduled Recall bot ("Jim") on meetings where the user is the
 *    sole attendee (so a queued bot can't join after they've cut us off),
 *  - revoke GammaMeet's OAuth grant at Google (removes every granted
 *    permission), and
 *  - clear all stored Google/calendar state.
 *
 * The account itself is kept — the user can reconnect by signing in again.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;

  const { data: user } = await supabase
    .from("users")
    .select("id, google_refresh_token, cal_channel_id, cal_resource_id")
    .eq("email", email)
    .single();

  if (user?.google_refresh_token) {
    const refreshToken = user.google_refresh_token as string;

    // Get a short-lived access token so we can tear down the calendar watch
    // channel. If the refresh token is already dead, skip the watch stop — the
    // channel expires on its own and the grant revoke below still runs.
    let accessToken: string | null = null;
    try {
      accessToken = await refreshGoogleToken(refreshToken);
    } catch (err) {
      if (!(err instanceof RefreshTokenInvalidError)) {
        console.error(`Disconnect: token refresh failed for ${email}:`, err);
      }
    }

    // Stop Google Calendar push notifications to our webhook.
    if (accessToken && user.cal_channel_id && user.cal_resource_id) {
      await stopCalendarWatch(accessToken, user.cal_channel_id, user.cal_resource_id);
    }

    // Cancel scheduled bots on the user's solo meetings before we lose access.
    await cancelUserSoloMeetingBots(email);

    // Revoke the OAuth grant at Google — removes GammaMeet's access to the
    // user's Google account and every permission they granted.
    await revokeGoogleGrant(refreshToken);
  }

  // Clear all Google/calendar state. needs_reauth=false because this was a
  // deliberate disconnect, not an expired token — so no "reconnect" nag banner.
  await supabase
    .from("users")
    .update({
      google_refresh_token: null,
      cal_channel_id: null,
      cal_resource_id: null,
      cal_expiry: null,
      needs_reauth: false,
    })
    .eq("email", email);

  return NextResponse.json({ ok: true });
}
