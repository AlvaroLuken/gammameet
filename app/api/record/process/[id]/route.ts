import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { transcribeAudioUrl } from "@/lib/deepgram";
import { generateMeetingBrief, buildPromptFromRecallTranscript, transcriptToText } from "@/lib/recall";
import { generateGammaPage } from "@/lib/gamma";
import { sendRecapEmail } from "@/lib/email";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 300;

const RECORDINGS_BUCKET = "recordings";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*, meeting_invites(email)")
    .eq("id", id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  // Ownership check: only someone invited to the meeting can process it
  const invitedEmails: string[] = meeting.meeting_invites?.map((i: { email: string }) => i.email) ?? [];
  if (!invitedEmails.includes(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (meeting.gamma_url) {
    return NextResponse.json({ ok: true, gammaUrl: meeting.gamma_url, alreadyProcessed: true });
  }

  // Atomic claim so a double-click doesn't run the pipeline twice
  const { data: claim } = await supabase
    .from("meetings")
    .update({ bot_status: "processing" })
    .eq("id", id)
    .is("gamma_url", null)
    .neq("bot_status", "processing")
    .select("id")
    .maybeSingle();

  if (!claim) {
    return NextResponse.json({ error: "Already processing" }, { status: 409 });
  }

  try {
    // Find the uploaded file — only one file per meeting folder
    const { data: files, error: listErr } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .list(id, { limit: 1 });
    if (listErr || !files || files.length === 0) {
      throw new Error("No uploaded audio found for this recording");
    }
    const path = `${id}/${files[0].name}`;

    // Signed download URL Deepgram can fetch directly (valid 10 min, plenty for pipeline)
    const { data: signed, error: signedErr } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .createSignedUrl(path, 600);
    if (signedErr || !signed) throw new Error(`Failed to sign audio URL: ${signedErr?.message}`);

    const segments = await transcribeAudioUrl(signed.signedUrl);
    const totalWords = segments.reduce((n, s) => n + s.words.length, 0);
    if (totalWords < 20) {
      await supabase
        .from("meetings")
        .update({ transcript_error: true, bot_status: "failed", failure_reason: "empty_transcript" })
        .eq("id", id);
      return NextResponse.json({ error: "empty_transcript" }, { status: 422 });
    }

    const participantNames = [...new Set(segments.map((s) => s.speaker ?? "Unknown"))];
    const title: string = meeting.title;

    let briefThrew = false;
    const brief = await generateMeetingBrief(segments, title, meeting.start_time, participantNames).catch((err) => {
      briefThrew = true;
      console.error("Claude brief failed during record processing:", err);
      Sentry.captureException(err, {
        tags: { component: "claude_brief_throw", source: "record_process" },
        extra: { meetingId: id, title, transcriptSegments: segments.length },
      });
      return { summary: "", actionItems: "", gammaBrief: "", numCards: 8 };
    });

    if (!briefThrew && (!brief.summary || !brief.gammaBrief)) {
      Sentry.captureMessage("Meeting brief empty without exception", {
        level: "warning",
        tags: { component: "claude_brief_empty", source: "record_process" },
        extra: {
          meetingId: id,
          title,
          hasSummary: !!brief.summary,
          hasGammaBrief: !!brief.gammaBrief,
          actionItemsLength: brief.actionItems.length,
          numCards: brief.numCards,
          transcriptSegments: segments.length,
        },
      });
    }

    const gammaInput = brief.gammaBrief || buildPromptFromRecallTranscript(title, meeting.start_time, participantNames, segments);
    const { gammaUrl, exportUrl, previewImage } = await generateGammaPage(title, gammaInput, brief.numCards);

    const { error: critErr } = await supabase
      .from("meetings")
      .update({
        gamma_url: gammaUrl,
        export_url: exportUrl,
        preview_image: previewImage,
        bot_status: "ended",
        end_time: new Date().toISOString(),
      })
      .eq("id", id);
    if (critErr) throw new Error(`DB update failed: ${critErr.message}`);

    // Summary/action_items are optional — column may not exist on all environments
    const { error: extraErr } = await supabase
      .from("meetings")
      .update({ summary: brief.summary, action_items: brief.actionItems })
      .eq("id", id);
    if (extraErr) {
      console.error("summary/actions update failed (non-fatal):", extraErr);
      Sentry.captureException(extraErr, {
        tags: { component: "db_update_summary", source: "record_process" },
        extra: { meetingId: id },
      });
    }

    // Optional — gamma_brief column may not exist yet. Claude's distilled
    // version of the transcript, as fed to Gamma.
    const { error: bErr } = await supabase
      .from("meetings")
      .update({ gamma_brief: brief.gammaBrief })
      .eq("id", id);
    if (bErr) {
      console.error("gamma_brief update failed (non-fatal):", bErr);
      Sentry.captureException(bErr, {
        tags: { component: "db_update_gamma_brief", source: "record_process" },
        extra: { meetingId: id },
      });
    }

    // Optional — transcript_text column may not exist yet
    const { error: tErr } = await supabase
      .from("meetings")
      .update({ transcript_text: transcriptToText(segments) })
      .eq("id", id);
    if (tErr) {
      console.error("transcript_text update failed (non-fatal):", tErr);
      Sentry.captureException(tErr, {
        tags: { component: "db_update_transcript", source: "record_process" },
        extra: { meetingId: id },
      });
    }

    // Atomic single-shot send guard — see webhook/recall for rationale.
    const { data: emailClaim } = await supabase
      .from("meetings")
      .update({ recap_emailed_at: new Date().toISOString() })
      .eq("id", id)
      .is("recap_emailed_at", null)
      .select("id")
      .maybeSingle();

    if (emailClaim) {
      const recipients = invitedEmails.length > 0 ? invitedEmails : [session.user.email];
      const gammaMeetUrl = `${process.env.APP_URL ?? "https://gammameet.vercel.app"}/meetings/${id}`;
      await sendRecapEmail({
        to: recipients,
        meetingTitle: title,
        meetingDate: meeting.start_time,
        gammaUrl: gammaMeetUrl,
        previewImage,
      }).catch((err) => console.error("Recap email failed (non-fatal):", err));
    } else {
      console.log(`Record: recap email already sent for ${id} — skipping`);
    }

    return NextResponse.json({ ok: true, gammaUrl, meetingId: id });
  } catch (err) {
    console.error("Record processing failed:", err);
    Sentry.captureException(err, {
      tags: { component: "process_meeting_throw", source: "record_process" },
      extra: { meetingId: id },
    });
    await supabase
      .from("meetings")
      .update({ transcript_error: true, bot_status: "failed", failure_reason: "transcript_failed" })
      .eq("id", id);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
