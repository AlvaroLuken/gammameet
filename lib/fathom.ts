const FATHOM_API_URL = process.env.FATHOM_API_URL ?? "https://api.fathom.video/v1";

export interface FathomTranscriptSegment {
  speaker: { display_name: string; matched_calendar_invitee_email?: string | null };
  text: string;
  timestamp: string;
}

export interface FathomWebhookPayload {
  title?: string;
  meeting_title?: string;
  recording_id?: string;
  url?: string;
  transcript?: FathomTranscriptSegment[];
  default_summary?: string;
  action_items?: string[];
  calendar_invitees?: { email: string }[];
}

function fathomHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function registerWebhook(accessToken: string, destinationUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${FATHOM_API_URL}/webhooks`, {
      method: "POST",
      headers: fathomHeaders(accessToken),
      body: JSON.stringify({
        destination_url: destinationUrl,
        include_transcript: true,
        include_summary: true,
        include_action_items: true,
      }),
    });
    if (!res.ok) {
      console.error("Fathom registerWebhook failed:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.id ?? null;
  } catch {
    return null;
  }
}

export async function revokeWebhook(accessToken: string, webhookId: string): Promise<void> {
  try {
    await fetch(`${FATHOM_API_URL}/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: fathomHeaders(accessToken),
    });
  } catch {
    // best-effort
  }
}

export function buildPromptFromFathomPayload(payload: FathomWebhookPayload): string {
  const title = payload.meeting_title ?? payload.title ?? "Untitled Meeting";
  const attendees = (payload.calendar_invitees ?? []).map((i) => i.email);

  const lines = [
    `Meeting: ${title}`,
    attendees.length ? `Attendees: ${attendees.join(", ")}` : "",
    "",
  ].filter((l) => l !== undefined);

  if (payload.default_summary) {
    lines.push("## Summary", payload.default_summary, "");
  }

  if (payload.action_items?.length) {
    lines.push("## Action Items", ...payload.action_items, "");
  }

  if (payload.transcript?.length) {
    lines.push("## Transcript");
    for (const seg of payload.transcript) {
      lines.push(`${seg.speaker.display_name}: ${seg.text}`);
    }
  }

  return lines.join("\n");
}
