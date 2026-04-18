import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const transcriptId = req.nextUrl.searchParams.get("id");
  if (!transcriptId) {
    return NextResponse.json({ error: "Pass ?id=YOUR_TRANSCRIPT_ID" }, { status: 400 });
  }

  // Enqueue and immediately process
  await supabase
    .from("pending_jobs")
    .upsert({ transcript_id: transcriptId, status: "pending" }, { onConflict: "transcript_id" });

  const appUrl = process.env.APP_URL ?? "https://gammameet.vercel.app";
  const res = await fetch(`${appUrl}/api/process-jobs`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "" },
  });

  const data = await res.json();
  return NextResponse.json(data);
}
