const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: string;
  participants: string[];
  summary: { overview: string; action_items: string };
  sentences: { text: string; speaker_name: string }[];
}

export async function fetchTranscript(transcriptId: string, apiKey: string): Promise<FirefliesTranscript> {
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
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables: { transcriptId } }),
  });

  const json = await res.json();
  if (json.errors) throw new Error(`Fireflies error: ${JSON.stringify(json.errors)}`);
  return json.data.transcript;
}

export async function registerWebhook(accessToken: string, webhookUrl: string): Promise<string | null> {
  const mutation = `
    mutation CreateWebhook($webhook_url: String!) {
      createWebhook(webhook_url: $webhook_url, event_type: "Transcription completed") {
        id
        webhook_url
      }
    }
  `;

  try {
    const res = await fetch(FIREFLIES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: mutation, variables: { webhook_url: webhookUrl } }),
    });
    const json = await res.json();
    return json.data?.createWebhook?.id ?? null;
  } catch {
    return null;
  }
}

export async function revokeWebhook(accessToken: string, webhookId: string): Promise<void> {
  const mutation = `
    mutation DeleteWebhook($webhook_id: String!) {
      deleteWebhook(webhook_id: $webhook_id) {
        success
      }
    }
  `;

  try {
    await fetch(FIREFLIES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: mutation, variables: { webhook_id: webhookId } }),
    });
  } catch {
    // best-effort
  }
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
