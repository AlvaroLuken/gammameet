import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getAudioDownloadUrl } from "@/lib/recall";

export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("recall_bot_id, title, meeting_invites(email)")
    .eq("id", id)
    .single();

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attendees: string[] = meeting.meeting_invites?.map((i: { email: string }) => i.email) ?? [];
  if (!attendees.includes(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!meeting.recall_bot_id) {
    return NextResponse.json({ expired: true, reason: "No recording for this meeting." }, { status: 410 });
  }

  const url = await getAudioDownloadUrl(meeting.recall_bot_id).catch(() => null);
  if (!url) {
    return NextResponse.json({ expired: true, reason: "Recording download period has ended." }, { status: 410 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ expired: true, reason: "Recording download period has ended." }, { status: 410 });
  }

  const safeName = (meeting.title ?? "recording").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Content-Disposition": `attachment; filename="${safeName}.mp3"`,
      "Cache-Control": "no-store",
    },
  });
}
