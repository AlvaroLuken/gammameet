import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getBotData, buildPromptFromRecallTranscript, inferTitleFromSegments } from "@/lib/recall";
import { generateGammaPage } from "@/lib/gamma";

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .eq("id", id)
    .single();

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only attendees can regenerate
  const isAttendee = meeting.meeting_invites?.some((i: { email: string }) => i.email === session.user.email);
  if (!isAttendee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!meeting.recall_bot_id) {
    return NextResponse.json({ error: "No bot recording available to regenerate from" }, { status: 400 });
  }

  try {
    const { segments, meetingTitle: recallTitle, participantEmails } = await getBotData(meeting.recall_bot_id);

    const participantNames = [...new Set(segments.map((s: { participant?: { name?: string }; speaker?: string }) => s.participant?.name ?? s.speaker ?? "Unknown"))];
    const title = meeting.title || recallTitle || inferTitleFromSegments(segments);

    const existingEmails = meeting.meeting_invites?.map((i: { email: string }) => i.email) ?? [];
    const allEmails = [...new Set([...existingEmails, ...participantEmails])].filter(Boolean);

    const content = buildPromptFromRecallTranscript(title, meeting.start_time, participantNames, segments);
    const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(title, content);

    await supabase
      .from("meetings")
      .update({ gamma_url: gammaUrl, export_url: exportUrl, preview_image: previewImage, transcript_error: false, failure_reason: null, bot_status: "ended" })
      .eq("id", id);

    return NextResponse.json({ ok: true, gammaUrl, exportUrl, previewImage });
  } catch (err) {
    console.error("Regenerate failed:", err);
    return NextResponse.json({ error: "Failed to regenerate deck. The recording may no longer be available." }, { status: 500 });
  }
}
