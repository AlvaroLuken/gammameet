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
    recording_config: {
      transcript: { provider: { recallai_streaming: {} } },
      audio_mixed_mp3: {},
    },
    automatic_video_output: {
      in_call_recording: { kind: "jpeg", b64_data: getBotAvatarB64() },
    },
    chat: {
      on_bot_join: {
        send_to: "everyone",
        message:
          "👋 Hi, I'm Jim from GammaMeet. I'll record and transcribe this call and email an AI-generated recap deck to all attendees when it ends. The audio recording is available to attendees for download for a limited time. Learn more: https://www.gamma-meet.com/faq",
        pin: true,
      },
    },
    automatic_leave: { waiting_room_timeout: 1200, noone_joined_timeout: 1200 },
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

/**
 * Find all Recall bots tagged with a GammaMeet meeting id. Useful for recovering
 * from the case where multiple bots were created for the same meeting (via a
 * historical race) and the stored recall_bot_id points to one that has no recording.
 *
 * Filters client-side by metadata.gammameet_meeting_id because Recall's list
 * endpoint query params don't reliably honor metadata filters.
 */
export async function findBotsForMeeting(meetingId: string): Promise<string[]> {
  const collected: Array<{ id?: string; metadata?: Record<string, string> | null }> = [];
  // Walk up to 3 pages (~300 bots) of the most-recent bots
  let nextUrl: string | null = `${RECALL_BASE}/bot/?ordering=-created_at&page_size=100`;
  for (let page = 0; page < 3 && nextUrl; page++) {
    const res: Response = await fetch(nextUrl, { headers: recallHeaders() });
    if (!res.ok) break;
    const data = await res.json();
    const batch: Array<{ id?: string; metadata?: Record<string, string> | null }> = Array.isArray(data?.results)
      ? data.results
      : (Array.isArray(data) ? data : []);
    collected.push(...batch);
    nextUrl = typeof data?.next === "string" ? data.next : null;
  }

  return collected
    .filter((b) => b.metadata?.gammameet_meeting_id === meetingId)
    .map((b) => b.id)
    .filter((id): id is string => !!id);
}

export interface BotData {
  segments: RecallTranscriptSegment[];
  meetingTitle: string | null;
  participantEmails: string[];
  humanParticipantCount: number;
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

  // Fetch participants from Recall. We need both the emails (for invite upsert)
  // and a count of non-bot humans (to tell "nobody joined" from "joined silently").
  const participantsUrl = recording?.media_shortcuts?.participant_events?.data?.participants_download_url;
  let participantEmails: string[] = [];
  let humanParticipantCount = 0;
  if (participantsUrl) {
    try {
      const pRes = await fetch(participantsUrl);
      if (pRes.ok) {
        const participants = await pRes.json();
        const list: { email?: string; is_host?: boolean; platform?: string; extra_data?: { is_bot?: boolean } }[] =
          Array.isArray(participants) ? participants : [];
        const humans = list.filter((p) => !p.extra_data?.is_bot);
        humanParticipantCount = humans.length;
        participantEmails = humans
          .map((p) => p.email)
          .filter((e): e is string => !!e);
      }
    } catch { /* ignore */ }
  }

  return { segments, meetingTitle, participantEmails, humanParticipantCount };
}

export async function getTranscript(botId: string): Promise<RecallTranscriptSegment[]> {
  return (await getBotData(botId)).segments;
}

/**
 * Pull a fresh signed download URL for the bot's mixed audio recording.
 * Returns null when no recording is available (e.g. bot was created before
 * audio output was enabled, or Recall has aged out the underlying file).
 */
export async function getAudioDownloadUrl(botId: string): Promise<string | null> {
  const res = await fetch(`${RECALL_BASE}/bot/${botId}/`, { headers: recallHeaders() });
  if (!res.ok) return null;
  const bot = await res.json();
  const recording = bot.recordings?.[0];
  const url = recording?.media_shortcuts?.audio_mixed?.data?.download_url;
  return typeof url === "string" && url.length > 0 ? url : null;
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

export async function verifyBotForMeeting(botId: string, meetingId: string): Promise<boolean> {
  const meta = await getBotMetadata(botId);
  return meta.gammameet_meeting_id === meetingId;
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
import * as Sentry from "@sentry/nextjs";

export function transcriptToText(segments: RecallTranscriptSegment[]): string {
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
  numCards: number;     // recommended slide count for Gamma, clamped 4–14
}

export type MeetingType =
  | "standup"
  | "one_on_one"
  | "customer_call"
  | "brainstorm"
  | "interview"
  | "retro"
  | "all_hands"
  | "general";

export function detectMeetingType(title: string, participantCount: number): MeetingType {
  const t = title.toLowerCase();
  if (/\bstand.?up\b|daily sync|daily check.?in|daily scrum/.test(t)) return "standup";
  if (/\b1:?1\b|\b1-.?1\b|1 on 1|one.on.one|\bcatch.?up\b|mentor/.test(t)) return "one_on_one";
  if (/customer|client|sales call|discovery|demo|prospect|account review|qbr/.test(t)) return "customer_call";
  if (/brainstorm|ideation|whiteboard|jam|workshop|design sprint/.test(t)) return "brainstorm";
  if (/interview|screen call|candidate|onsite|hiring/.test(t)) return "interview";
  if (/retro|retrospective|post.?mortem|debrief|postmortem/.test(t)) return "retro";
  if (/all.?hands|town.?hall|company.?wide|quarterly review|ama/.test(t)) return "all_hands";
  // Fallback heuristic: 2 people → 1:1, otherwise general
  if (participantCount === 2) return "one_on_one";
  return "general";
}

const TYPE_GUIDANCE: Record<MeetingType, string> = {
  standup:
    "This is a daily/weekly standup. Focus on what each person is working on, any blockers raised, and priority shifts. Structure the deck around people or workstreams, not time. Surface any cross-team dependencies. Skip small talk.",
  one_on_one:
    "This is a 1:1 between two people. Treat it as personal and coaching-oriented. Highlight career/growth topics, feedback given or received, commitments either person made, and emotional/relational notes if present. Be tactful — this deck may be re-read by both participants.",
  customer_call:
    "This is a customer or client call. Lead with the customer's goals, pain points, and any commitments our side made. Capture specific quotes from the customer verbatim (they're gold for product and sales). Include use cases, objections, competitors mentioned, and follow-up asks. Treat this as sales/account intelligence.",
  brainstorm:
    "This is a brainstorm or ideation session. The goal is capturing ideas, not decisions. Cluster ideas by theme, preserve the diverging creative energy, and don't over-summarize. Include wildcard ideas even if they didn't get traction. End with the most promising directions, not a single 'winner'.",
  interview:
    "This is an interview. Stay neutral and professional. Summarize the candidate's background, their strongest signal moments (both positive and concerning), specific answers to key questions, and open questions for next rounds. Do not make a hire/no-hire recommendation — that's the interviewer's call.",
  retro:
    "This is a retrospective or post-mortem. Structure the deck around: what went well, what didn't, what surprised us, and concrete process changes. For incidents, include a timeline and root cause. Explicit action items with owners are critical here.",
  all_hands:
    "This is an all-hands or town hall. Lead with announcements and strategic updates. Cluster Q&A by topic. Capture the overall tone (celebratory, anxious, informational). Skip redundant restating of slides the presenter showed.",
  general:
    "This is a general business meeting. Organize by theme, lead with decisions and outcomes, and extract concrete action items with owners.",
};

export async function generateMeetingBrief(
  segments: RecallTranscriptSegment[],
  meetingTitle: string,
  meetingDate: string,
  participants: string[],
  meetingType?: MeetingType
): Promise<MeetingBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set, skipping LLM brief");
    Sentry.captureMessage("ANTHROPIC_API_KEY missing — meeting brief skipped", {
      level: "error",
      tags: { component: "claude_brief_config" },
      extra: { meetingTitle, participantCount: participants.length },
    });
    return { summary: "", actionItems: "", gammaBrief: "", numCards: 8 };
  }

  const text = transcriptToText(segments);
  if (!text.trim()) return { summary: "", actionItems: "", gammaBrief: "", numCards: 8 };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const resolvedType: MeetingType = meetingType ?? detectMeetingType(meetingTitle, participants.length);
  const typeGuidance = TYPE_GUIDANCE[resolvedType];

  const systemPrompt = `You are a senior strategist preparing a post-meeting brief. Your job is to turn a raw transcript into a crisp, insight-heavy analysis that will be rendered as a polished presentation deck.

**Meeting type detected: ${resolvedType}**
${typeGuidance}

Write as a clear analyst, not a note-taker. Organize by theme, not chronology. Lead with WHY things matter, not just WHAT was said. Use the participants' actual words as quotes when they're pithy or load-bearing. Skip filler — no "we then talked about" summaries of summaries.

Submit your brief by invoking the submit_meeting_brief tool. Don't return any prose outside the tool call.`;

  const userMessage = `Meeting: ${meetingTitle}
Type: ${resolvedType}
Date: ${meetingDate}
Participants: ${participants.join(", ")}

Transcript:
${text}`;

  // Force structured output via tool use rather than asking Claude to embed
  // JSON in free text. The SDK gives us toolUse.input as already-parsed
  // structured data — eliminates the JSON.parse failure class (e.g.,
  // unescaped quotes inside verbatim transcript pulls in gammaBrief).
  const briefTool = {
    name: "submit_meeting_brief",
    description: "Submit the structured meeting brief: summary, action items, presentation deck markdown, and recommended slide count.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "2-4 sentences. What was this meeting about, what got decided, and why does it matter? Not a retelling — a takeaway. Write for someone who wasn't there.",
        },
        actionItems: {
          type: "array",
          items: { type: "string" },
          description: "Every next step, follow-up, task, and commitment from the meeting — not just formal assignments. Include loosely-committed items ('we should look into X', 'I'll probably reach out to Y') and implicit ones ('we need to figure out Z'). Include the owner if mentioned (e.g. 'Alice: Ship the dashboard mockup by Friday'). Aim for 3-10 items for a typical 15+ minute meeting. Empty array only if the conversation was truly non-actionable.",
        },
        gammaBrief: {
          type: "string",
          description: "Structured markdown Gamma will turn into a presentation. Use H1 for the title, H2 for major sections. Default sections unless type guidance suggests otherwise: TL;DR, Key Decisions, Action Items, Core Themes (one sub-section per topic with insight and attributed quotes), Open Questions, Notable Quotes, Participants, Next Steps.",
        },
        numCards: {
          type: "integer",
          minimum: 4,
          maximum: 14,
          description: "Number of slides this deck should have, based on richness and breadth. A 5-min standup with one decision: 4-5. A typical 30-min meeting: 7-9. An hour-long discussion with many distinct topics or a dense customer call: 10-14. Match slide count to content; don't pad or compress.",
        },
      },
      required: ["summary", "actionItems", "gammaBrief", "numCards"],
    },
  };

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    system: systemPrompt,
    tools: [briefTool],
    tool_choice: { type: "tool", name: "submit_meeting_brief" },
    messages: [{ role: "user", content: userMessage }],
  });

  const briefContext = {
    meetingTitle,
    meetingType: resolvedType,
    transcriptChars: text.length,
    participantCount: participants.length,
    stopReason: res.stop_reason,
    inputTokens: res.usage?.input_tokens,
    outputTokens: res.usage?.output_tokens,
  };

  // Truncation can cut off tool-input mid-emission, leaving us without a
  // valid tool_use block. Distinguish from "Claude refused" in triage.
  if (res.stop_reason === "max_tokens") {
    Sentry.captureMessage("Claude meeting brief hit max_tokens", {
      level: "warning",
      extra: briefContext,
    });
  }

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== "submit_meeting_brief") {
    Sentry.captureMessage("Claude did not return submit_meeting_brief tool call", {
      level: "warning",
      tags: { component: "claude_brief_no_tool_use" },
      extra: { ...briefContext, contentBlockTypes: res.content.map((b) => b.type) },
    });
    return { summary: "", actionItems: "", gammaBrief: "", numCards: 8 };
  }

  const input = toolUse.input as {
    summary?: unknown;
    actionItems?: unknown;
    gammaBrief?: unknown;
    numCards?: unknown;
  };

  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const gammaBrief = typeof input.gammaBrief === "string" ? input.gammaBrief.trim() : "";
  const actions: string[] = Array.isArray(input.actionItems)
    ? input.actionItems.filter((a): a is string => typeof a === "string")
    : [];
  const rawNumCards = Number(input.numCards);
  const numCards = Number.isFinite(rawNumCards)
    ? Math.min(14, Math.max(4, Math.round(rawNumCards)))
    : 8;

  // Fallback: if Claude returned an empty actionItems array but wrote them
  // under "## Action Items" in gammaBrief, extract them from there.
  let actionItems = actions.map((a) => "· " + a).join("\n");
  if (!actionItems && gammaBrief) {
    const extracted = extractActionItemsFromMarkdown(gammaBrief);
    if (extracted.length > 0) {
      actionItems = extracted.map((a) => "· " + a).join("\n");
      console.log(`[brief] Extracted ${extracted.length} action items from markdown fallback`);
    }
  }

  console.log(`[brief] Claude returned: summary=${summary.length}ch, actionItems=${actions.length}, gammaBrief=${gammaBrief.length}ch, numCards=${numCards}`);
  return { summary, actionItems, gammaBrief, numCards };
}

function extractActionItemsFromMarkdown(md: string): string[] {
  // Find "## Action Items" section and pull its bullet/list lines
  const lines = md.split("\n");
  const sectionIdx = lines.findIndex((l) => /^##\s+action items/i.test(l.trim()));
  if (sectionIdx === -1) return [];
  const items: string[] = [];
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("##")) break; // next section
    const m = line.match(/^[-*·•]\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  // Filter out placeholder lines like "No committed actions from this conversation."
  return items.filter((it) => !/^no (committed )?actions?/i.test(it) && it.length > 3);
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
