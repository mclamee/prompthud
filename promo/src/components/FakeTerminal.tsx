import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Fake terminal shown when no real recording exists yet.
// Replace this by dropping a real demo.mp4 into promo/public/ and flipping
// HAS_RECORDED_DEMO = true in scenes/Demo.tsx.

const PROMPTS = [
  "how do I add auth",
  "fix the login redirect",
  "add jwt refresh token",
  "debug session persistence",
  "why is cookie not set",
  "add remember-me checkbox",
  "test the logout flow",
  "handle expired refresh tokens",
  "add rate limiting middleware",
  "write tests for auth flow",
];

export const FakeTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Reveal prompts faster (~2.5/s) so all 10 appear in ~4s of the 15s demo.
  const revealPerFrame = 2.5 / fps;
  const visibleCount = Math.min(PROMPTS.length, 1 + Math.floor(frame * revealPerFrame));
  const visible = PROMPTS.slice(0, visibleCount);
  const past = visible.slice(0, -1);
  const current = visible[visible.length - 1] ?? "";
  const currentIdx = visibleCount;

  const hudOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        inset: 80,
        top: 120,
        backgroundColor: "#141420",
        borderRadius: 16,
        border: "1px solid #2a2a3a",
        padding: 40,
        fontFamily: "'JetBrains Mono', 'Menlo', monospace",
        fontSize: 28,
        color: "#cbd5e1",
        overflow: "hidden",
      }}
    >
      {/* Faux window chrome */}
      <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
        {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
          <div key={c} style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: c }} />
        ))}
        <div style={{ color: "#64748b", marginLeft: 16, fontSize: 22 }}>~ claude code session</div>
      </div>

      {/* Faux chat content */}
      <div style={{ opacity: 0.6, lineHeight: 1.8 }}>
        <div style={{ color: "#64748b" }}>› streamed tokens…</div>
        <div style={{ color: "#64748b" }}>› streamed tokens…</div>
        <div style={{ color: "#64748b" }}>› ...</div>
      </div>

      <div style={{ marginTop: 40, color: "#a78bfa" }}>
        &gt; {current}
        <span style={{ opacity: Math.sin(frame / 4) > 0 ? 1 : 0 }}>▍</span>
      </div>

      {/* The HUD row — main subject */}
      <div
        style={{
          opacity: hudOpacity,
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#0a0a12",
          borderTop: "1px solid #2a2a3a",
          padding: "22px 30px",
          fontSize: 22,
          color: "#cbd5e1",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span style={{ color: "#c084fc" }}>☰ {visibleCount}</span>
        {past.map((p, i) => (
          <span key={i}>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: "#64748b" }}>{i + 1}.</span>
            <span style={{ color: "#67e8f9" }}>{p}</span>
          </span>
        ))}
        {current && (
          <span>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: "#86efac", fontWeight: 700 }}>
              ▶ {currentIdx}.{current}
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
