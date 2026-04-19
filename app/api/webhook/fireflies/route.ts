import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchTranscript, buildPromptFromTranscript } from "@/lib/fireflies";
import { generateGammaPage } from "@/lib/gamma";
import { sendRecapEmail } from "@/lib/email";

export const maxDuration = 300;

function verifyToken(req: NextRequest): boolean {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.nextUrl.searchParams.get("token") === secret;
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { meeting_id?: string; event?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcriptId = payload.meeting_id;
  if (!transcriptId || payload.event === "test") {
    return NextResponse.json({ received: true, test: true });
  }

  try {
    const transcript = await fetchTranscript(transcriptId);
    const content = buildPromptFromTranscript(transcript);
    const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(transcript.title, content);

    const startTime = new Date(Number(transcript.date)).toISOString();

    const { data: meeting, error } = await supabase
      .from("meetings")
      .upsert({
        title: transcript.title,
        start_time: startTime,
        fireflies_id: transcriptId,
        gamma_url: gammaUrl,
        export_url: exportUrl,
        preview_image: previewImage,
      }, { onConflict: "fireflies_id" })
      .select()
      .single();

    if (error || !meeting) throw new Error(`Failed to upsert meeting: ${error?.message}`);

    if (transcript.participants.length > 0) {
      await supabase.from("meeting_invites").upsert(
        transcript.participants.map((email) => ({ meeting_id: meeting.id, email })),
        { onConflict: "meeting_id,email" }
      );

      const gammaMeetUrl = `${process.env.APP_URL ?? "https://gammameet.vercel.app"}/meetings/${meeting.id}`;
      await sendRecapEmail({
        to: transcript.participants,
        meetingTitle: transcript.title,
        meetingDate: startTime,
        gammaUrl: gammaMeetUrl,
        previewImage,
      }).catch((err) => console.error("Email send failed:", err));
    }

    console.log(`Processed: "${transcript.title}" → ${gammaUrl}`);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Processing failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
