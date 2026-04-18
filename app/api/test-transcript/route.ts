import { NextRequest, NextResponse } from "next/server";
import { processTranscript } from "@/app/api/webhook/fireflies/route";

// Manual trigger for testing — remove before going public
export async function GET(req: NextRequest) {
  const transcriptId = req.nextUrl.searchParams.get("id");
  if (!transcriptId) {
    return NextResponse.json({ error: "Pass ?id=YOUR_TRANSCRIPT_ID" }, { status: 400 });
  }

  try {
    await processTranscript(transcriptId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
