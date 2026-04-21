import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getBotData, buildPromptFromRecallTranscript, inferTitleFromSegments, findBotsForMeeting, generateMeetingBrief, type BotData } from "@/lib/recall";
import { generateGammaPage } from "@/lib/gamma";

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .eq("id", id)
    .single();

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only attendees can regenerate
  const isAttendee = meeting.meeting_invites?.some((i: { email: string }) => i.email === session.user.email);
  if (!isAttendee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Build the list of bots to try, in priority order:
  //   1) the bot id stored on the meeting
  //   2) any other bots Recall has tagged with this meeting id (recovers from historical duplicate-bot races)
  const candidateIds: string[] = [];
  if (meeting.recall_bot_id) candidateIds.push(meeting.recall_bot_id);
  try {
    const otherBots = await findBotsForMeeting(id);
    for (const b of otherBots) if (!candidateIds.includes(b)) candidateIds.push(b);
  } catch (err) {
    console.warn("Failed to list bots for meeting (continuing with primary):", err);
  }

  if (candidateIds.length === 0) {
    return NextResponse.json({ error: "No bot recording available to regenerate from" }, { status: 400 });
  }

  // Try each bot until one returns a transcript
  let botData: BotData | null = null;
  let usedBotId: string | null = null;
  const errors: string[] = [];
  for (const botId of candidateIds) {
    try {
      botData = await getBotData(botId);
      if (botData.segments.length > 0) {
        usedBotId = botId;
        break;
      }
    } catch (err) {
      errors.push(`${botId}: ${String(err)}`);
      continue;
    }
  }

  if (!botData || !usedBotId) {
    console.error(`Regenerate: no usable bot for meeting ${id}. Tried: ${candidateIds.join(", ")}. Errors: ${errors.join(" | ")}`);
    return NextResponse.json(
      { error: "No recording found for this meeting. The bot may not have been admitted, or the recording has expired." },
      { status: 404 }
    );
  }

  try {
    const { segments, meetingTitle: recallTitle, participantEmails } = botData;

    const participantNames = [...new Set(segments.map((s) => s.participant?.name ?? s.speaker ?? "Unknown"))];
    const title = meeting.title || recallTitle || inferTitleFromSegments(segments);

    const existingEmails = meeting.meeting_invites?.map((i: { email: string }) => i.email) ?? [];
    const allEmails = [...new Set([...existingEmails, ...participantEmails])].filter(Boolean);

    // Use the Claude-powered structured brief (same pipeline as fresh meetings)
    const brief = await generateMeetingBrief(segments, title, meeting.start_time, participantNames).catch((err) => {
      console.error("Claude brief failed during regenerate, falling back:", err);
      return { summary: "", actionItems: "", gammaBrief: "" };
    });
    const gammaInput = brief.gammaBrief || buildPromptFromRecallTranscript(title, meeting.start_time, participantNames, segments);
    const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(title, gammaInput);

    await supabase
      .from("meetings")
      .update({
        gamma_url: gammaUrl,
        export_url: exportUrl,
        preview_image: previewImage,
        transcript_error: false,
        failure_reason: null,
        bot_status: "ended",
        summary: brief.summary,
        action_items: brief.actionItems,
        // Repoint to the bot that actually had the transcript
        recall_bot_id: usedBotId,
      })
      .eq("id", id);

    // Make sure any discovered participant emails are in the invites list
    if (allEmails.length > 0) {
      await supabase.from("meeting_invites").upsert(
        allEmails.map((email) => ({ meeting_id: id, email })),
        { onConflict: "meeting_id,email" }
      );
    }

    return NextResponse.json({ ok: true, gammaUrl, exportUrl, previewImage });
  } catch (err) {
    console.error("Regenerate failed:", err);
    return NextResponse.json({ error: "Failed to regenerate deck. Please try again later." }, { status: 500 });
  }
}
