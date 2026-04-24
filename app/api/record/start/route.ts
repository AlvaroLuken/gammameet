import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

const RECORDINGS_BUCKET = "recordings";

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === RECORDINGS_BUCKET)) return;
  await supabase.storage.createBucket(RECORDINGS_BUCKET, { public: false });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  // Rate limit: max 10 recordings started per user per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("meetings")
    .select("id, meeting_invites!inner(email)", { count: "exact", head: true })
    .eq("meeting_invites.email", session.user.email)
    .is("meet_link", null)
    .gte("created_at", oneHourAgo);
  if ((recentCount ?? 0) >= 10) {
    return NextResponse.json(
      { error: "Rate limit reached: 10 recordings per hour." },
      { status: 429 }
    );
  }

  await supabase.from("users").upsert(
    { email: session.user.email, name: session.user.name, image: session.user.image },
    { onConflict: "email" }
  );

  const now = new Date();
  const defaultTitle = `Recording — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  const { data: meeting, error: insertErr } = await supabase
    .from("meetings")
    .insert({
      title: body.title?.trim() || defaultTitle,
      start_time: now.toISOString(),
      bot_status: "recording",
    })
    .select()
    .single();

  if (insertErr || !meeting) {
    console.error("Record start: failed to create meeting row:", insertErr);
    return NextResponse.json({ error: "Failed to create recording" }, { status: 500 });
  }

  await supabase.from("meeting_invites").upsert(
    [{ meeting_id: meeting.id, email: session.user.email }],
    { onConflict: "meeting_id,email" }
  );

  await ensureBucket();

  const uploadPath = `${meeting.id}/${randomUUID()}.webm`;
  const { data: signed, error: signedErr } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUploadUrl(uploadPath);

  if (signedErr || !signed) {
    console.error("Record start: signed upload URL failed:", signedErr);
    return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 });
  }

  return NextResponse.json({
    meetingId: meeting.id,
    uploadUrl: signed.signedUrl,
    uploadToken: signed.token,
    uploadPath,
  });
}
