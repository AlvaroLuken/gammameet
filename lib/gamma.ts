const GAMMA_API_URL = "https://api.gamma.app/v1";

export async function generateGammaPage(
  title: string,
  content: string
): Promise<string> {
  const res = await fetch(`${GAMMA_API_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GAMMA_API_KEY}`,
    },
    body: JSON.stringify({
      title,
      text: content,
      mode: "webpage",
      theme: "auto",
    }),
  });

  if (!res.ok) {
    throw new Error(`Gamma API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  if (data.status === "pending" || data.status === "processing") {
    return pollGammaStatus(data.id);
  }

  return data.url;
}

async function pollGammaStatus(generationId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(`${GAMMA_API_URL}/generate/${generationId}`, {
      headers: { Authorization: `Bearer ${process.env.GAMMA_API_KEY}` },
    });

    const data = await res.json();
    if (data.status === "completed" && data.url) return data.url;
    if (data.status === "failed") throw new Error("Gamma generation failed");
  }

  throw new Error("Gamma generation timed out");
}
