import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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

  await supabase.from("meeting_invites").delete().eq("meeting_id", id);
  await supabase.from("meetings").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
