import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildPromptFromFathomPayload, FathomWebhookPayload } from "@/lib/fathom";
import { generateGammaPage } from "@/lib/gamma";
import { sendRecapEmail } from "@/lib/email";

export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  let payload: FathomWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.transcript?.length) {
    return NextResponse.json({ received: true, skipped: "no transcript" });
  }

  const title = payload.meeting_title ?? payload.title ?? "Untitled Meeting";
  const attendees = (payload.calendar_invitees ?? []).map((i) => i.email).filter(Boolean);
  const summary = payload.default_summary ?? null;
  const actionItems = payload.action_items?.join("\n") ?? null;

  try {
    const content = buildPromptFromFathomPayload(payload);
    const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(title, content);

    const startTime = new Date().toISOString();

    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({
        title,
        start_time: startTime,
        gamma_url: gammaUrl,
        export_url: exportUrl,
        preview_image: previewImage,
        summary,
        action_items: actionItems,
      })
      .select()
      .single();

    if (error || !meeting) throw new Error(`Failed to insert meeting: ${error?.message}`);

    // Link to user + all attendees
    const emails = [...new Set([...(await getUserEmail(uid)), ...attendees])].filter(Boolean);
    if (emails.length > 0) {
      await supabase.from("meeting_invites").upsert(
        emails.map((email) => ({ meeting_id: meeting.id, email })),
        { onConflict: "meeting_id,email" }
      );
    }

    if (attendees.length > 0) {
      const gammaMeetUrl = `${process.env.APP_URL ?? "https://gammameet.vercel.app"}/meetings/${meeting.id}`;
      await sendRecapEmail({
        to: attendees,
        meetingTitle: title,
        meetingDate: startTime,
        gammaUrl: gammaMeetUrl,
        previewImage,
      }).catch((err) => console.error("Email send failed:", err));
    }

    console.log(`Fathom: processed "${title}" → ${gammaUrl}`);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Fathom webhook processing failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function getUserEmail(uid: string): Promise<string[]> {
  const { data } = await supabase.from("users").select("email").eq("id", uid).single();
  return data?.email ? [data.email] : [];
}
