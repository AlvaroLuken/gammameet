import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GammaMeet — AI meeting recap decks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "black",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 96,
            height: 96,
            background: "#7c3aed",
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
          }}
        >
          ✦
        </div>

        {/* Wordmark */}
        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, color: "white" }}>
          Gamma
          <span style={{ color: "#7c3aed" }}>Meet</span>
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 32, color: "#a1a1aa", textAlign: "center", maxWidth: 800 }}>
          Turn every meeting into a beautiful AI-generated deck
        </div>
      </div>
    ),
    { ...size }
  );
}
