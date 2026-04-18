const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  participants: string[];
  summary: { overview: string; action_items: string };
  sentences: { text: string; speaker_name: string }[];
}

export async function fetchTranscript(transcriptId: string): Promise<FirefliesTranscript> {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id title date participants
        summary { overview action_items }
        sentences { text speaker_name }
      }
    }
  `;

  const res = await fetch(FIREFLIES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({ query, variables: { transcriptId } }),
  });

  const json = await res.json();
  if (json.errors) throw new Error(`Fireflies error: ${JSON.stringify(json.errors)}`);
  return json.data.transcript;
}

export function buildPromptFromTranscript(t: FirefliesTranscript): string {
  const lines: string[] = [
    `Meeting: ${t.title}`,
    `Date: ${new Date(t.date).toLocaleDateString()}`,
    `Participants: ${t.participants.join(", ")}`,
    "",
  ];

  if (t.summary?.overview) {
    lines.push("## Overview", t.summary.overview, "");
  }
  if (t.summary?.action_items) {
    lines.push("## Action Items", t.summary.action_items, "");
  }
  if (t.sentences?.length) {
    lines.push("## Transcript");
    for (const s of t.sentences) lines.push(`${s.speaker_name}: ${s.text}`);
  }

  return lines.join("\n");
}
