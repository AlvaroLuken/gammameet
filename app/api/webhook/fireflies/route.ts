import { NextRequest, NextResponse } from "next/server";
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

  let payload: { transcriptId?: string; meetingId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcriptId = payload.transcriptId ?? payload.meetingId;
  if (!transcriptId) {
    return NextResponse.json({ received: true, test: true });
  }

  // Enqueue the job — processing happens via /api/process-jobs
  await supabase
    .from("pending_jobs")
    .upsert({ transcript_id: transcriptId, status: "pending" }, { onConflict: "transcript_id" });

  // Kick off processor immediately (fire and forget)
  const appUrl = process.env.APP_URL ?? "https://gammameet.vercel.app";
  fetch(`${appUrl}/api/process-jobs`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  }).catch(() => {});

  return NextResponse.json({ received: true });
}
