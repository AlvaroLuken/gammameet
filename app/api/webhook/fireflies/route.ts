import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { fetchTranscript, buildPromptFromTranscript } from "@/lib/fireflies";
import { generateGammaPage } from "@/lib/gamma";
import { supabase } from "@/lib/supabase";

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;
  if (!secret) return true;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.length === expected.length ? signature : expected);
  return crypto.timingSafeEqual(a, b) && signature === expected;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { transcriptId?: string; meetingId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcriptId = payload.transcriptId ?? payload.meetingId;
  if (!transcriptId) {
    return NextResponse.json({ error: "Missing transcriptId" }, { status: 400 });
  }

  // Respond immediately, process in background
  processTranscript(transcriptId).catch((err) =>
    console.error("Error processing transcript:", err)
  );

  return NextResponse.json({ received: true });
}

async function processTranscript(transcriptId: string) {
  const transcript = await fetchTranscript(transcriptId);
  const content = buildPromptFromTranscript(transcript);
  const gammaUrl = await generateGammaPage(transcript.title, content);

  // Try to match to an existing calendar meeting by title + date proximity
  const meetingDate = new Date(transcript.date);
  const dayStart = new Date(meetingDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(meetingDate);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: existing } = await supabase
    .from("meetings")
    .select("id")
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString())
    .ilike("title", `%${transcript.title.split(" ")[0]}%`)
    .single();

  if (existing) {
    await supabase
      .from("meetings")
      .update({ gamma_url: gammaUrl, fireflies_id: transcriptId })
      .eq("id", existing.id);
  } else {
    // No calendar match — create a standalone meeting entry
    const { data: meeting } = await supabase
      .from("meetings")
      .insert({
        title: transcript.title,
        start_time: transcript.date,
        fireflies_id: transcriptId,
        gamma_url: gammaUrl,
      })
      .select()
      .single();

    if (meeting) {
      const invites = transcript.participants.map((email) => ({
        meeting_id: meeting.id,
        email,
      }));
      await supabase.from("meeting_invites").insert(invites);
    }
  }

  console.log(`Processed: "${transcript.title}" → ${gammaUrl}`);
}
