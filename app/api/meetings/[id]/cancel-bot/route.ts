import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { deleteBot } from "@/lib/recall";

/**
 * Cancel the bot for a scheduled meeting. Keeps the meeting visible on the
 * dashboard so the user can re-enable later.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: invite } = await supabase
    .from("meeting_invites")
    .select("id")
    .eq("meeting_id", id)
    .eq("email", session.user.email)
    .single();
  if (!invite) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, recall_bot_id, bot_status")
    .eq("id", id)
    .maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (meeting.recall_bot_id && meeting.bot_status !== "ended" && meeting.bot_status !== "processing") {
    try {
      await deleteBot(meeting.recall_bot_id);
    } catch (err) {
      console.error(`Failed to delete Recall bot ${meeting.recall_bot_id}:`, err);
    }
  }

  // bot_status="disabled" blocks sync's atomic claim from creating a new bot.
  await supabase
    .from("meetings")
    .update({ recall_bot_id: null, bot_status: "disabled" })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
