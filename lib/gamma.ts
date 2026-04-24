const GAMMA_API_URL = "https://public-api.gamma.app/v1.0";

export interface GammaResult {
  gammaUrl: string;
  exportUrl: string | null;
  previewImage: string | null;
}

export async function generateGammaPage(
  title: string,
  content: string,
  numCards: number = 8
): Promise<GammaResult> {
  // Gamma accepts 1–60 but anything outside ~4–14 produces junk decks for meetings.
  const cards = Math.min(14, Math.max(4, Math.round(numCards)));
  const res = await fetch(`${GAMMA_API_URL}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.GAMMA_API_KEY!,
    },
    body: JSON.stringify({
      inputText: `${title}\n\n${content}`,
      textMode: "generate",
      format: "presentation",
      numCards: cards,
      exportAs: "pdf",
      cardOptions: {
        dimensions: "16x9",
      },
      imageOptions: {
        source: "aiGenerated",
        stylePreset: "abstract",
        // Free-form guidance wins over preset alone — keeps Gamma from inventing
        // faces/offices/participants (the "fake stock photo of fake people" problem).
        style: "minimal abstract shapes and gradients, no people, no faces, no characters, no office scenes, muted professional colors, editorial",
      },
      sharingOptions: {
        // Non-GammaMeet users should be able to view the deck without signing into Gamma.
        externalAccess: "view",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gamma API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const generationId = data.generationId ?? data.id;

  return pollGammaStatus(generationId);
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "GammaMeet/1.0" } });
    const html = await res.text();
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function pollGammaStatus(generationId: string): Promise<GammaResult> {
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(`${GAMMA_API_URL}/generations/${generationId}`, {
      headers: { "X-API-KEY": process.env.GAMMA_API_KEY! },
    });

    const data = await res.json();

    if (data.status === "completed" && data.gammaUrl) {
      const previewImage = await fetchOgImage(data.gammaUrl);
      return {
        gammaUrl: data.gammaUrl,
        exportUrl: data.exportUrl ?? null,
        previewImage,
      };
    }
    if (data.status === "failed") throw new Error("Gamma generation failed");
  }

  throw new Error("Gamma generation timed out after 2 minutes");
}
