import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Hard-delete a meeting. Gated to meetings that have already failed — there's
 * nothing to recover at that point, and soft-delete (the DELETE endpoint) just
 * leaves clutter in the DB. Successful meetings keep the soft-delete path.
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
    .select("id, transcript_error, bot_status")
    .eq("id", id)
    .single();
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Safety: only permit hard-delete for meetings that actually failed.
  const isFailed = !!meeting.transcript_error || meeting.bot_status === "failed";
  if (!isFailed) {
    return NextResponse.json({ error: "Can only purge failed meetings" }, { status: 400 });
  }

  await supabase.from("meeting_invites").delete().eq("meeting_id", id);
  await supabase.from("meetings").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
