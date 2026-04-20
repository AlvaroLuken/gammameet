import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GammaMeet — Every meeting, beautifully decked.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Ambient violet glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 700,
            height: 700,
            background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0.1) 35%, rgba(0,0,0,0) 70%)",
            display: "flex",
          }}
        />

        {/* Top: wordmark */}
        <div style={{ display: "flex", alignItems: "center", fontSize: 42, fontWeight: 700, color: "white", letterSpacing: -1 }}>
          Gamma<span style={{ color: "#8b5cf6" }}>Meet</span>
        </div>

        {/* Middle: hero text */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 120,
              fontWeight: 800,
              color: "white",
              lineHeight: 1,
              letterSpacing: -4,
            }}
          >
            <span>Every meeting,</span>
            <span style={{ color: "#8b5cf6" }}>beautifully decked.</span>
          </div>
          <div style={{ display: "flex", fontSize: 36, color: "#a1a1aa", maxWidth: 1000, lineHeight: 1.2 }}>
            AI-generated recap decks, the moment your meeting ends.
          </div>
        </div>

        {/* Bottom: URL + accent */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 28,
              color: "#71717a",
              fontWeight: 500,
            }}
          >
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: "#8b5cf6" }} />
            gamma-meet.com
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 22,
              color: "#8b5cf6",
              background: "rgba(139,92,246,0.12)",
              border: "1px solid rgba(139,92,246,0.3)",
              padding: "10px 20px",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            ✦ Powered by Gamma AI
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
