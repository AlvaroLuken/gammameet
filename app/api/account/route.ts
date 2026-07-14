import { NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { deleteBot } from "@/lib/recall";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  // Look up the user
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (user) {
    // Meetings are associated to a user through meeting_invites.email (there is
    // no meetings.user_id column). Capture the set of meetings this user was in
    // BEFORE removing their invites, so we can decide which ones are now orphaned.
    const { data: invites } = await supabase
      .from("meeting_invites")
      .select("meeting_id")
      .eq("email", email);
    const meetingIds = [...new Set((invites ?? []).map((r) => r.meeting_id))];

    // Remove this user's invites first so the "any invites remain?" check below
    // reflects the post-deletion state.
    await supabase.from("meeting_invites").delete().eq("email", email);

    // For each meeting the user was in, if no other invitee remains it is now
    // orphaned: cancel the scheduled Recall bot ("Jim") so it never joins, then
    // delete the meeting row. Meetings still shared with other attendees are
    // left untouched — their bots belong to those users.
    for (const meetingId of meetingIds) {
      const { count } = await supabase
        .from("meeting_invites")
        .select("id", { count: "exact", head: true })
        .eq("meeting_id", meetingId);
      if ((count ?? 0) > 0) continue; // still shared — leave bot + meeting alone

      const { data: meeting } = await supabase
        .from("meetings")
        .select("recall_bot_id, bot_status")
        .eq("id", meetingId)
        .maybeSingle();

      // Cancel Jim unless the bot has already run / is mid-processing (matches
      // the guard in /api/meetings/[id]/cancel-bot).
      if (
        meeting?.recall_bot_id &&
        meeting.bot_status !== "ended" &&
        meeting.bot_status !== "processing"
      ) {
        try {
          await deleteBot(meeting.recall_bot_id);
        } catch (err) {
          // Best-effort: a failed cancel must not block account deletion, but we
          // log loudly so a stray bot is visible in triage.
          console.error(
            `Account deletion: failed to cancel Recall bot ${meeting.recall_bot_id} for meeting ${meetingId}:`,
            err
          );
        }
      }

      await supabase.from("meetings").delete().eq("id", meetingId);
    }

    // Delete the user record
    await supabase.from("users").delete().eq("id", user.id);
  }

  await signOut({ redirect: false });

  return NextResponse.json({ ok: true });
}
