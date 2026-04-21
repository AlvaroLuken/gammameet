import fs from "fs";
import path from "path";

const RECALL_BASE = `https://${process.env.RECALLAI_REGION ?? "us-west-2"}.recall.ai/api/v1`;

function recallHeaders() {
  return {
    Authorization: `Token ${process.env.RECALLAI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

let _botAvatarB64: string | null = null;
function getBotAvatarB64(): string {
  if (_botAvatarB64) return _botAvatarB64;
  const p = path.join(process.cwd(), "public", "bot-avatar.jpg");
  _botAvatarB64 = fs.readFileSync(p).toString("base64");
  return _botAvatarB64;
}

export interface RecallTranscriptSegment {
  // v1 format
  participant?: { name: string; email?: string };
  // v2 format
  speaker?: string;
  words: { text: string }[];
}

export async function createBot({
  meetingUrl,
  joinAt,
  meetingId,
}: {
  meetingUrl: string;
  joinAt?: string;
  meetingId: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    meeting_url: meetingUrl,
    bot_name: "Jim from GammaMeet",
    recording_config: { transcript: { provider: { recallai_streaming: {} } } },
    automatic_video_output: {
      in_call_recording: { kind: "jpeg", b64_data: getBotAvatarB64() },
    },
    chat: {
      on_bot_join: {
        send_to: "everyone",
        message:
          "👋 Hi, I'm Jim from GammaMeet. I'll transcribe this call and email an AI-generated recap deck to all attendees when it ends. Learn more: https://www.gamma-meet.com/faq",
        pin: true,
      },
    },
    metadata: { gammameet_meeting_id: meetingId },
  };
  if (joinAt) body.join_at = joinAt;

  const res = await fetch(`${RECALL_BASE}/bot/`, {
    method: "POST",
    headers: recallHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Recall createBot failed: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

export async function deleteBot(botId: string): Promise<void> {
  const res = await fetch(`${RECALL_BASE}/bot/${botId}/`, {
    method: "DELETE",
    headers: recallHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Recall deleteBot failed: ${await res.text()}`);
  }
}

export interface BotData {
  segments: RecallTranscriptSegment[];
  meetingTitle: string | null;
  participantEmails: string[];
}

export async function getBotData(botId: string): Promise<BotData> {
  const botRes = await fetch(`${RECALL_BASE}/bot/${botId}/`, { headers: recallHeaders() });
  if (!botRes.ok) throw new Error(`Recall getBot failed: ${await botRes.text()}`);
  const bot = await botRes.json();

  const recording = bot.recordings?.[0];

  const downloadUrl = recording?.media_shortcuts?.transcript?.data?.download_url;
  if (!downloadUrl) throw new Error("No transcript download URL on bot");

  const dlRes = await fetch(downloadUrl);
  if (!dlRes.ok) throw new Error(`Recall transcript download failed: ${await dlRes.text()}`);
  const raw = await dlRes.json();
  const segments: RecallTranscriptSegment[] = Array.isArray(raw) ? raw : (raw.results ?? []);

  const meetingTitle: string | null = recording?.media_shortcuts?.meeting_metadata?.data?.title ?? null;

  // Fetch participant emails from Recall's participants list
  const participantsUrl = recording?.media_shortcuts?.participant_events?.data?.participants_download_url;
  let participantEmails: string[] = [];
  if (participantsUrl) {
    try {
      const pRes = await fetch(participantsUrl);
      if (pRes.ok) {
        const participants = await pRes.json();
        participantEmails = (Array.isArray(participants) ? participants : [])
          .map((p: { email?: string }) => p.email)
          .filter((e): e is string => !!e);
      }
    } catch { /* ignore */ }
  }

  return { segments, meetingTitle, participantEmails };
}

export async function getTranscript(botId: string): Promise<RecallTranscriptSegment[]> {
  return (await getBotData(botId)).segments;
}

export function inferTitleFromSegments(segments: RecallTranscriptSegment[]): string {
  const stopWords = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','i','we','you','he','she','it','this','that','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','can','just','so','like','about','up','out','if','as','by','from','my','our','your','its','their','all','not','no','yes','ok','okay','right','yeah','um','uh','ah','going','know','think','want','get','got','one','two','also','now','really','very','good','well','here','there','when','where','what','how','why','who']);
  const words = segments.slice(0, 60).flatMap(s => s.words.map(w => w.text.trim().toLowerCase()));
  const freq: Record<string, number> = {};
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, '');
    if (clean.length > 3 && !stopWords.has(clean)) freq[clean] = (freq[clean] ?? 0) + 1;
  }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w[0].toUpperCase() + w.slice(1));
  return top.length > 0 ? top.join(', ') + ' Discussion' : 'Team Meeting';
}

export async function getBotMetadata(botId: string): Promise<Record<string, string>> {
  const res = await fetch(`${RECALL_BASE}/bot/${botId}/`, {
    headers: recallHeaders(),
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.metadata ?? {};
}

import Anthropic from "@anthropic-ai/sdk";

function transcriptToText(segments: RecallTranscriptSegment[]): string {
  return segments
    .map((s) => {
      const name = s.speaker ?? s.participant?.name ?? "Unknown";
      const text = s.words.map((w) => w.text).join(" ").trim();
      return text ? `${name}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export interface MeetingBrief {
  summary: string;      // 2-4 sentence exec summary (for sidebar)
  actionItems: string;  // bullet list of committed tasks (for sidebar)
  gammaBrief: string;   // structured markdown doc fed to Gamma for deck generation
}

export async function generateMeetingBrief(
  segments: RecallTranscriptSegment[],
  meetingTitle: string,
  meetingDate: string,
  participants: string[]
): Promise<MeetingBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set, skipping LLM brief");
    return { summary: "", actionItems: "", gammaBrief: "" };
  }

  const text = transcriptToText(segments);
  if (!text.trim()) return { summary: "", actionItems: "", gammaBrief: "" };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are a senior strategist preparing a post-meeting brief. Your job is to turn a raw transcript into a crisp, insight-heavy analysis that will be rendered as a polished presentation deck.

Write as a clear analyst, not a note-taker. Organize by theme, not chronology. Lead with WHY things matter, not just WHAT was said. Use the participants' actual words as quotes when they're pithy or load-bearing. Skip filler — no "we then talked about" summaries of summaries.

Return strict JSON with exactly these three fields, no prose outside the JSON:

{
  "summary": "2-4 sentences. What was this meeting about, what got decided, and why does it matter? Not a retelling — a takeaway. Write for someone who wasn't there.",
  "actionItems": ["Each committed task, one per string. Include the owner if mentioned (e.g. \\"Alice: Ship the dashboard mockup by Friday\\"). Empty array if nothing actionable. Never invent."],
  "gammaBrief": "A structured markdown document Gamma will turn into a presentation. Use H1 for the title, H2 for major sections. Target 8 sections that make great slides. Required sections:\\n\\n# {meeting title}\\n\\n## TL;DR\\n2-3 sentences on the biggest takeaway.\\n\\n## Key Decisions\\nBulleted, concrete. If no real decisions, say so honestly.\\n\\n## Action Items\\nBulleted with owners. If none, say 'No committed actions from this conversation.'\\n\\n## Core Themes\\nFor each major topic, a short heading and 2-4 sentences of insight. Use relevant direct quotes in italics with attribution. This is the meat of the deck.\\n\\n## Open Questions\\nThings raised but not resolved. What's still unknown.\\n\\n## Notable Quotes\\n2-4 memorable lines with speaker names. Pick ones that capture tone, insight, or tension.\\n\\n## Participants\\nAttendees and context on their roles if inferable.\\n\\n## Next Steps\\nForward-looking. What happens after this meeting — scheduled follow-ups, dependencies, etc."
}`;

  const userMessage = `Meeting: ${meetingTitle}
Date: ${meetingDate}
Participants: ${participants.join(", ")}

Transcript:
${text}`;

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const content = res.content[0];
  if (content.type !== "text") return { summary: "", actionItems: "", gammaBrief: "" };

  try {
    const match = content.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : content.text);
    const actions: string[] = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
    return {
      summary: String(parsed.summary ?? "").trim(),
      actionItems: actions.map((a) => "· " + a).join("\n"),
      gammaBrief: String(parsed.gammaBrief ?? "").trim(),
    };
  } catch (err) {
    console.error("Failed to parse Claude brief response:", err, content.text);
    return { summary: "", actionItems: "", gammaBrief: "" };
  }
}

// Back-compat wrapper
export async function generateSummaryAndActions(segments: RecallTranscriptSegment[]) {
  const { summary, actionItems } = await generateMeetingBrief(segments, "Meeting", new Date().toISOString(), []);
  return { summary, actionItems };
}

export function buildPromptFromRecallTranscript(
  title: string,
  date: string,
  participants: string[],
  segments: RecallTranscriptSegment[]
): string {
  const lines = [
    `Meeting: ${title}`,
    `Date: ${new Date(date).toLocaleDateString()}`,
    `Participants: ${participants.join(", ")}`,
    "",
    "## Transcript",
  ];

  for (const seg of segments) {
    const text = seg.words.map((w) => w.text).join(" ").trim();
    const name = seg.speaker ?? seg.participant?.name ?? "Unknown";
    if (text) lines.push(`${name}: ${text}`);
  }

  return lines.join("\n");
}
