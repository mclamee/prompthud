import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Scale = spring({ frame, fps, config: { damping: 14 }, from: 0.85, to: 1 });
  const line1Opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const line2Scale = spring({ frame: frame - 14, fps, config: { damping: 14 }, from: 0.85, to: 1 });
  const line2Opacity = interpolate(frame, [14, 24], [0, 1], { extrapolateRight: "clamp" });
  const repoOpacity = interpolate(frame, [32, 50], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #1a1a24 0%, #0d0d12 70%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
        gap: 28,
      }}
    >
      <div
        style={{
          opacity: line1Opacity,
          transform: `scale(${line1Scale})`,
          backgroundColor: "#1e1e2a",
          padding: "26px 48px",
          borderRadius: 18,
          border: "2px solid #312e4a",
          fontFamily: "'JetBrains Mono', 'Menlo', monospace",
          fontSize: 42,
          color: "#e2e8f0",
        }}
      >
        <span style={{ color: "#a78bfa" }}>/plugin marketplace add</span>{" "}
        mclamee/prompthud
      </div>

      <div
        style={{
          opacity: line2Opacity,
          transform: `scale(${line2Scale})`,
          backgroundColor: "#1e1e2a",
          padding: "26px 48px",
          borderRadius: 18,
          border: "2px solid #312e4a",
          fontFamily: "'JetBrains Mono', 'Menlo', monospace",
          fontSize: 42,
          color: "#e2e8f0",
        }}
      >
        <span style={{ color: "#a78bfa" }}>/plugin install</span>{" "}
        prompthud@prompthud
      </div>

      <div
        style={{
          opacity: repoOpacity,
          fontSize: 32,
          color: "#94a3b8",
          marginTop: 12,
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
