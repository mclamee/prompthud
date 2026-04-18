import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cmdScale = spring({ frame, fps, config: { damping: 14 }, from: 0.85, to: 1 });
  const cmdOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const repoOpacity = interpolate(frame, [14, 28], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #1a1a24 0%, #0d0d12 70%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
        gap: 56,
      }}
    >
      <div
        style={{
          opacity: cmdOpacity,
          transform: `scale(${cmdScale})`,
          backgroundColor: "#1e1e2a",
          padding: "36px 56px",
          borderRadius: 20,
          border: "2px solid #312e4a",
          fontFamily: "'JetBrains Mono', 'Menlo', monospace",
          fontSize: 54,
          color: "#e2e8f0",
        }}
      >
        <span style={{ color: "#a78bfa" }}>/plugin install</span>{" "}
        prompthud@prompthud
      </div>

      <div
        style={{
          opacity: repoOpacity,
          fontSize: 36,
          color: "#94a3b8",
        }}
      >
        github.com/mclamee/prompthud
      </div>

      <div
        style={{
          opacity: repoOpacity,
          position: "absolute",
          bottom: 48,
          fontSize: 22,
          color: "#475569",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        MIT · zero dependencies
      </div>
    </AbsoluteFill>
  );
};
