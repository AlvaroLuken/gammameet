import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchTranscript, buildPromptFromTranscript } from "@/lib/fireflies";
import { generateGammaPage } from "@/lib/gamma";
import { sendRecapEmail } from "@/lib/email";

export const maxDuration = 300;

function verifySecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("x-cron-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Grab one pending job
  const { data: job } = await supabase
    .from("pending_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(1)
    .single();

  if (!job) return NextResponse.json({ done: true, message: "No pending jobs" });

  // Mark as processing
  await supabase.from("pending_jobs").update({ status: "processing" }).eq("id", job.id);

  try {
    await processTranscript(job.transcript_id);
    await supabase.from("pending_jobs").update({ status: "done" }).eq("id", job.id);
    return NextResponse.json({ success: true, transcriptId: job.transcript_id });
  } catch (err) {
    await supabase.from("pending_jobs").update({ status: "failed" }).eq("id", job.id);
    console.error("Job failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function processTranscript(transcriptId: string) {
  const transcript = await fetchTranscript(transcriptId);
  const content = buildPromptFromTranscript(transcript);
  const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(transcript.title, content);

  let meetingId: string;

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
        summary: transcript.summary?.overview ?? null,
        action_items: transcript.summary?.action_items ?? null,
      }, { onConflict: "fireflies_id" })
      .select()
      .single();

  if (error || !meeting) throw new Error(`Failed to upsert meeting: ${error?.message}`);
  meetingId = meeting.id;

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
      meetingDate: startTime,
      gammaUrl: gammaMeetUrl,
      previewImage,
    }).catch((err) => console.error("Email send failed:", err));
  }

  console.log(`Processed: "${transcript.title}" → ${gammaUrl}`);
}
