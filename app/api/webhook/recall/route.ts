import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBotData, getBotMetadata, buildPromptFromRecallTranscript, inferTitleFromSegments, generateSummaryAndActions } from "@/lib/recall";
import { generateGammaPage } from "@/lib/gamma";
import { sendRecapEmail } from "@/lib/email";

export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("Recall webhook payload:", JSON.stringify(payload));

  const event = payload.event as string | undefined;
  // Recall payload: { event, data: { bot: { id, metadata }, status: { code } } }
  const data = payload.data as Record<string, unknown> | undefined;
  const botObj = data?.bot as Record<string, unknown> | undefined;
  const transcriptObj = data?.transcript as Record<string, unknown> | undefined;

  if (event === "transcript.failed") {
    const botId = botObj?.id as string | undefined;
    if (botId) {
      await supabase.from("meetings").update({ transcript_error: true, bot_status: "failed" }).eq("recall_bot_id", botId);
    }
    console.log("Recall transcript failed:", JSON.stringify(data));
    return NextResponse.json({ received: true, skipped: true });
  }

  // Bot state change events → update bot_status so UI reflects real-time state
  // Forward-only state machine: scheduled → joining → recording → ended  (or → failed at any point)
  const botStatusMap: Record<string, string> = {
    "bot.joining_call": "joining",
    "bot.in_waiting_room": "joining",
    "bot.in_call_not_recording": "joining",
    "bot.in_call_recording": "recording",
    "bot.recording_permission_allowed": "recording",
    "bot.call_ended": "ended",
    "bot.done": "ended",
    "bot.recording_permission_denied": "failed",
    "bot.fatal": "failed",
  };
  const rank: Record<string, number> = { scheduled: 0, joining: 1, recording: 2, ended: 3, failed: 99 };

  if (event && botStatusMap[event]) {
    const botId = botObj?.id as string | undefined;
    if (!botId) return NextResponse.json({ received: true, skipped: "no bot id" });

    const { data: m } = await supabase
      .from("meetings")
      .select("id, bot_status")
      .eq("recall_bot_id", botId)
      .single();

    if (m) {
      const next = botStatusMap[event];
      const current = (m.bot_status as string | null) ?? "scheduled";
      const update: Record<string, unknown> = {};
      // Only move forward (or to failed)
      if (next === "failed" || (rank[next] ?? 0) > (rank[current] ?? 0)) {
        update.bot_status = next;
      }
      if (next === "failed") update.transcript_error = true;
      if (Object.keys(update).length > 0) {
        await supabase.from("meetings").update(update).eq("id", m.id);
      }
    }
    return NextResponse.json({ received: true, status: botStatusMap[event] });
  }

  if (event !== "transcript.done") {
    console.log("Recall webhook skipped:", event);
    return NextResponse.json({ received: true, skipped: true });
  }

  const botId = botObj?.id as string | undefined;
  const transcriptId = transcriptObj?.id as string | undefined;
  if (!botId || !transcriptId) {
    return NextResponse.json({ error: "Missing bot or transcript ID" }, { status: 400 });
  }

  // Look up meeting by recall_bot_id
  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .eq("recall_bot_id", botId)
    .single();

  if (!meeting) {
    // Bot ID not found — try metadata fallback
    const meta = (botObj?.metadata as Record<string, string> | undefined) ?? await getBotMetadata(botId);
    const meetingId = meta.gammameet_meeting_id;
    if (!meetingId) {
      return NextResponse.json({ error: "Meeting not found for bot" }, { status: 404 });
    }
    const { data: m } = await supabase
      .from("meetings")
      .select("*, meeting_invites(email)")
      .eq("id", meetingId)
      .single();
    if (!m) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    return await processMeeting(m, botId);
  }

  return await processMeeting(meeting, botId);
}

async function processMeeting(
  meeting: { id: string; title: string; start_time: string; gamma_url?: string; meeting_invites?: { email: string }[] },
  botId: string
) {
  // Skip if already processed
  if (meeting.gamma_url) {
    return NextResponse.json({ received: true, skipped: "already processed" });
  }

  try {
    const { segments, meetingTitle: recallTitle, participantEmails } = await getBotData(botId);

    const participantNames = [...new Set(segments.map((s) => s.participant?.name ?? s.speaker ?? "Unknown"))];

    // Resolve best title: DB > Recall metadata > transcript inference
    const isGeneric = !meeting.title || meeting.title === "Ad-hoc Meeting";
    const title = isGeneric
      ? (recallTitle ?? inferTitleFromSegments(segments))
      : meeting.title;

    if (title !== meeting.title) {
      await supabase.from("meetings").update({ title }).eq("id", meeting.id);
    }

    // Merge existing invites with Recall participant emails
    const existingEmails = meeting.meeting_invites?.map((i: { email: string }) => i.email) ?? [];
    const allEmails = [...new Set([...existingEmails, ...participantEmails])].filter(Boolean);

    if (allEmails.length > 0) {
      await supabase.from("meeting_invites").upsert(
        allEmails.map((email) => ({ meeting_id: meeting.id, email })),
        { onConflict: "meeting_id,email" }
      );
    }

    const content = buildPromptFromRecallTranscript(title, meeting.start_time, participantNames, segments);
    const [{ summary, actionItems }, { gammaUrl, exportUrl, previewImage }] = await Promise.all([
      generateSummaryAndActions(segments).catch((err) => {
        console.error("Claude summary failed:", err);
        return { summary: "", actionItems: "" };
      }),
      generateGammaPage(title, content),
    ]);

    // Critical update — must succeed
    const { error: updateErr } = await supabase
      .from("meetings")
      .update({ gamma_url: gammaUrl, export_url: exportUrl, preview_image: previewImage })
      .eq("id", meeting.id);
    if (updateErr) {
      console.error("Critical DB update failed:", updateErr);
      throw new Error(`DB update failed: ${updateErr.message}`);
    }

    // Optional update — summary/action_items may fail if columns missing
    const { error: extraErr } = await supabase
      .from("meetings")
      .update({ summary, action_items: actionItems })
      .eq("id", meeting.id);
    if (extraErr) console.error("Summary/actions update failed (non-fatal):", extraErr);

    if (allEmails.length > 0) {
      const gammaMeetUrl = `${process.env.APP_URL ?? "https://gammameet.vercel.app"}/meetings/${meeting.id}`;
      await sendRecapEmail({
        to: allEmails,
        meetingTitle: title,
        meetingDate: meeting.start_time,
        gammaUrl: gammaMeetUrl,
        previewImage,
      }).catch((err) => console.error("Email send failed:", err));
    }

    console.log(`Recall: processed "${title}" → ${gammaUrl}`);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Recall processing failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
