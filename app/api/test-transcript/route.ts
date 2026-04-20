import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const botId = req.nextUrl.searchParams.get("bot_id") ?? "254f1524-95fb-4b93-b424-399b756ca787";
  const region = process.env.RECALLAI_REGION ?? "us-west-2";
  const headers = { Authorization: `Token ${process.env.RECALLAI_API_KEY}`, "Content-Type": "application/json" };

  const botRes = await fetch(`https://${region}.recall.ai/api/v1/bot/${botId}/`, { headers });
  const bot = await botRes.json();

  const participantsUrl = bot.recordings?.[0]?.media_shortcuts?.participant_events?.data?.participants_download_url;
  let participants = null;
  if (participantsUrl) {
    const pRes = await fetch(participantsUrl);
    participants = await pRes.json();
  }

  return NextResponse.json({ participantsUrl: !!participantsUrl, participants });
}
