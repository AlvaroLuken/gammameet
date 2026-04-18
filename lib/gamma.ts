const GAMMA_API_URL = "https://public-api.gamma.app/v1.0";

export interface GammaResult {
  gammaUrl: string;
  exportUrl: string | null;
  previewImage: string | null;
}

export async function generateGammaPage(
  title: string,
  content: string
): Promise<GammaResult> {
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
      numCards: 8,
      exportAs: "pdf",
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
