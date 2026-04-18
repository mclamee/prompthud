import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const CTACN: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cnScale = spring({ frame, fps, config: { damping: 14 }, from: 0.85, to: 1 });
  const cnOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const cmd1Scale = spring({ frame: frame - 14, fps, config: { damping: 14 }, from: 0.85, to: 1 });
  const cmd1Opacity = interpolate(frame, [14, 24], [0, 1], { extrapolateRight: "clamp" });
  const cmd2Scale = spring({ frame: frame - 26, fps, config: { damping: 14 }, from: 0.85, to: 1 });
  const cmd2Opacity = interpolate(frame, [26, 36], [0, 1], { extrapolateRight: "clamp" });
  const repoOpacity = interpolate(frame, [42, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #1a1a24 0%, #0d0d12 70%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', -apple-system, 'PingFang SC', 'Hiragino Sans GB', sans-serif",
        gap: 36,
        padding: "0 50px",
      }}
    >
      <div
        style={{
          opacity: cnOpacity,
          transform: `scale(${cnScale})`,
          fontSize: 64,
          fontWeight: 700,
          color: "#fff",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        在 Claude Code 里装上
      </div>

      <div
        style={{
          opacity: cmd1Opacity,
          transform: `scale(${cmd1Scale})`,
          backgroundColor: "#1e1e2a",
          padding: "28px 44px",
          borderRadius: 20,
          border: "2px solid #312e4a",
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 40,
          color: "#e2e8f0",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "#a78bfa" }}>/plugin marketplace add</span>
        <br />
        <span style={{ marginLeft: 24 }}>mclamee/prompthud</span>
      </div>

      <div
        style={{
          opacity: cmd2Opacity,
          transform: `scale(${cmd2Scale})`,
          backgroundColor: "#1e1e2a",
          padding: "28px 44px",
          borderRadius: 20,
          border: "2px solid #312e4a",
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 40,
          color: "#e2e8f0",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "#a78bfa" }}>/plugin install</span>
        <br />
        <span style={{ marginLeft: 24 }}>prompthud@prompthud</span>
      </div>

      <div
        style={{
          opacity: repoOpacity,
          marginTop: 24,
          fontSize: 34,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        github.com/mclamee/prompthud
      </div>

      <div
        style={{
          opacity: repoOpacity,
          position: "absolute",
          bottom: 80,
          fontSize: 26,
          color: "#64748b",
          letterSpacing: 2,
        }}
      >
        MIT · 开源免费
      </div>
    </AbsoluteFill>
  );
};
