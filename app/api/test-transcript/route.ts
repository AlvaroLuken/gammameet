import { NextRequest, NextResponse } from "next/server";
import { fetchTranscript, buildPromptFromTranscript } from "@/lib/fireflies";
import { generateGammaPage } from "@/lib/gamma";
import { supabase } from "@/lib/supabase";

// Manual trigger for testing — remove before going public
export async function GET(req: NextRequest) {
  const transcriptId = req.nextUrl.searchParams.get("id");
  if (!transcriptId) {
    return NextResponse.json({ error: "Pass ?id=YOUR_TRANSCRIPT_ID" }, { status: 400 });
  }

  try {
    const transcript = await fetchTranscript(transcriptId);
    const content = buildPromptFromTranscript(transcript);
    const gammaUrl = await generateGammaPage(transcript.title, content);

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
      .single();

    if (existing) {
      await supabase
        .from("meetings")
        .update({ gamma_url: gammaUrl, fireflies_id: transcriptId })
        .eq("id", existing.id);
    } else {
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
        await supabase.from("meeting_invites").insert(
          transcript.participants.map((email) => ({ meeting_id: meeting.id, email }))
        );
      }
    }

    return NextResponse.json({ success: true, gammaUrl });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
