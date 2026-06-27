import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  getBotData,
  buildPromptFromRecallTranscript,
  inferTitleFromSegments,
  findBotsForMeeting,
  generateMeetingBrief,
  verifyBotForMeeting,
  type BotData,
} from "@/lib/recall";
import { generateGammaPage } from "@/lib/gamma";
import { archiveGammaPdf } from "@/lib/deck-storage";

// Hobby plan caps serverless maxDuration at 300s. Batch runs would blow this,
// so the driver calls this route once per meeting via ?only=<id>.
export const maxDuration = 300;

// TEMPORARY one-off backfill: regenerate decks for meetings whose export_url is
// still a perishable Gamma presigned URL, archiving the fresh PDF to our own
// Supabase Storage. Guarded by the service-role key so it can't be hit publicly.
// DELETE THIS ROUTE after the backfill completes.
function isArchived(url: string | null): boolean {
  if (!url) return false;
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    return new URL(url).hostname === base.hostname;
  } catch {
    return false;
  }
}

async function regenerateMeeting(meeting: {
  id: string;
  title: string;
  start_time: string;
  recall_bot_id: string | null;
  meeting_invites?: { email: string }[];
}): Promise<{ id: string; status: string; detail?: string }> {
  const id = meeting.id;

  // Build candidate bot list (mirrors the regenerate endpoint).
  const candidateIds: string[] = [];
  if (meeting.recall_bot_id) {
    const ok = await verifyBotForMeeting(meeting.recall_bot_id, id).catch(() => false);
    if (ok) candidateIds.push(meeting.recall_bot_id);
  }
  try {
    for (const b of await findBotsForMeeting(id)) if (!candidateIds.includes(b)) candidateIds.push(b);
  } catch { /* continue with primary */ }

  if (candidateIds.length === 0) return { id, status: "skipped", detail: "no bot" };

  let botData: BotData | null = null;
  let usedBotId: string | null = null;
  for (const botId of candidateIds) {
    try {
      const d = await getBotData(botId);
      if (d.segments.length > 0) { botData = d; usedBotId = botId; break; }
    } catch { continue; }
  }
  if (!botData || !usedBotId) return { id, status: "failed", detail: "no usable transcript (recall expired?)" };

  const { segments, meetingTitle: recallTitle, participantEmails } = botData;
  const participantNames = [...new Set(segments.map((s) => s.participant?.name ?? s.speaker ?? "Unknown"))];
  const title = meeting.title || recallTitle || inferTitleFromSegments(segments);

  const brief = await generateMeetingBrief(segments, title, meeting.start_time, participantNames).catch(() => ({
    summary: "", actionItems: "", gammaBrief: "", numCards: 8,
  }));
  const gammaInput = brief.gammaBrief || buildPromptFromRecallTranscript(title, meeting.start_time, participantNames, segments);
  const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(title, gammaInput, brief.numCards);

  const archivedUrl = exportUrl ? await archiveGammaPdf(exportUrl, id) : null;
  if (!isArchived(archivedUrl)) {
    return { id, status: "failed", detail: `archive did not stick: ${archivedUrl}` };
  }

  await supabase
    .from("meetings")
    .update({
      gamma_url: gammaUrl,
      export_url: archivedUrl,
      preview_image: previewImage,
      transcript_error: false,
      failure_reason: null,
      bot_status: "ended",
      summary: brief.summary,
      action_items: brief.actionItems,
      recall_bot_id: usedBotId,
    })
    .eq("id", id);

  const existingEmails = meeting.meeting_invites?.map((i) => i.email) ?? [];
  const allEmails = [...new Set([...existingEmails, ...participantEmails])].filter(Boolean);
  if (allEmails.length > 0) {
    await supabase.from("meeting_invites").upsert(
      allEmails.map((email) => ({ meeting_id: id, email })),
      { onConflict: "meeting_id,email" }
    );
  }

  return { id, status: "ok", detail: archivedUrl! };
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Optional ?only=<meetingId> to validate a single meeting first.
  const only = req.nextUrl.searchParams.get("only");

  let query = supabase
    .from("meetings")
    .select("id, title, start_time, recall_bot_id, export_url, meeting_invites(email)")
    .not("export_url", "is", null)
    .order("created_at", { ascending: false });
  if (only) query = query.eq("id", only);

  const { data: meetings, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets = (meetings ?? []).filter((m) => only || !isArchived(m.export_url));
  const results: { id: string; status: string; detail?: string }[] = [];
  for (const m of targets) {
    try {
      const r = await regenerateMeeting(m);
      results.push(r);
      console.log(`backfill ${r.status}: ${r.id} ${r.detail ?? ""}`);
    } catch (err) {
      results.push({ id: m.id, status: "error", detail: String(err) });
      console.error(`backfill error: ${m.id}`, err);
    }
  }

  const summary = results.reduce<Record<string, number>>((a, r) => {
    a[r.status] = (a[r.status] ?? 0) + 1;
    return a;
  }, {});
  return NextResponse.json({ total: targets.length, summary, results });
}
