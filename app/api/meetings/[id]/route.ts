import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { deleteBot } from "@/lib/recall";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify the user is an attendee of this meeting
  const { data: invite } = await supabase
    .from("meeting_invites")
    .select("id")
    .eq("meeting_id", id)
    .eq("email", session.user.email)
    .single();

  if (!invite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Look up the meeting so we can clean up the Recall bot too
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, recall_bot_id, bot_status")
    .eq("id", id)
    .maybeSingle();

  // If a bot was scheduled but hasn't recorded anything useful yet, cancel it
  if (meeting?.recall_bot_id && meeting.bot_status !== "ended" && meeting.bot_status !== "processing") {
    try {
      await deleteBot(meeting.recall_bot_id);
    } catch (err) {
      console.error(`Failed to cancel bot ${meeting.recall_bot_id} on delete:`, err);
    }
  }

  // Soft delete: mark dismissed so calendar sync won't re-create it.
  // Hard-deleting causes it to reappear on the next sync because we can't
  // distinguish "never seen" from "user dismissed it".
  await supabase
    .from("meetings")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
