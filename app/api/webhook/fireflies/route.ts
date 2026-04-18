import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript, buildPromptFromTranscript } from "@/lib/fireflies";
import { generateGammaPage } from "@/lib/gamma";
import { sendRecapEmail } from "@/lib/email";
import { supabase } from "@/lib/supabase";

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

  const rawBody = await req.text();

  let payload: { transcriptId?: string; meetingId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcriptId = payload.transcriptId ?? payload.meetingId;
  if (!transcriptId) {
    // Fireflies test ping — no transcript yet, just acknowledge
    return NextResponse.json({ received: true, test: true });
  }

  processTranscript(transcriptId).catch((err) =>
    console.error("Error processing transcript:", err)
  );

  return NextResponse.json({ received: true });
}

export async function processTranscript(transcriptId: string) {
  const transcript = await fetchTranscript(transcriptId);
  const content = buildPromptFromTranscript(transcript);
  const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(transcript.title, content);

  const meetingDate = new Date(transcript.date);
  const dayStart = new Date(meetingDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(meetingDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Try to match an existing calendar meeting on the same day
  const { data: existingRows } = await supabase
    .from("meetings")
    .select("id")
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString());

  const existing = existingRows?.[0] ?? null;

  let meetingId: string;

  if (existing) {
    meetingId = existing.id;
    await supabase
      .from("meetings")
      .update({ gamma_url: gammaUrl, export_url: exportUrl, preview_image: previewImage, fireflies_id: transcriptId })
      .eq("id", meetingId);
  } else {
    // Upsert by fireflies_id so re-runs don't duplicate
    const { data: meeting, error } = await supabase
      .from("meetings")
      .upsert({
        title: transcript.title,
        start_time: transcript.date,
        fireflies_id: transcriptId,
        gamma_url: gammaUrl,
        export_url: exportUrl,
        preview_image: previewImage,
      }, { onConflict: "fireflies_id" })
      .select()
      .single();

    if (error || !meeting) throw new Error(`Failed to upsert meeting: ${error?.message}`);
    meetingId = meeting.id;
  }

  // Always upsert participants so they can see the recap in their dashboard
  if (transcript.participants.length > 0) {
    await supabase.from("meeting_invites").upsert(
      transcript.participants.map((email) => ({ meeting_id: meetingId, email })),
      { onConflict: "meeting_id,email" }
    );
  }

  const gammaMeetUrl = `${process.env.APP_URL ?? "https://gammameet.vercel.app"}/meetings/${meetingId}`;

  if (transcript.participants.length > 0) {
    await sendRecapEmail({
      to: transcript.participants,
      meetingTitle: transcript.title,
      meetingDate: transcript.date,
      gammaUrl: gammaMeetUrl,
      previewImage,
    }).catch((err) => console.error("Email send failed:", err));
  }

  console.log(`Processed: "${transcript.title}" → ${gammaUrl}`);
}
