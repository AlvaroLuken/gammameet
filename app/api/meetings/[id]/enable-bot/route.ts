import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Re-enable bot scheduling after the user previously cancelled it.
 * Clears bot_status so the next sync run will create a fresh Recall bot.
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

  await supabase
    .from("meetings")
    .update({ bot_status: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
