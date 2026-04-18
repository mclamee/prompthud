import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const TitleCardCN: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = spring({ frame, fps, config: { damping: 12 }, from: 40, to: 0 });
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const tagY = spring({ frame: frame - 8, fps, config: { damping: 12 }, from: 30, to: 0 });
  const tagOpacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });
  const painOpacity = interpolate(frame, [30, 48], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #1a1a24 0%, #0d0d12 70%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', -apple-system, 'PingFang SC', 'Hiragino Sans GB', sans-serif",
        textAlign: "center",
        padding: "0 60px",
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 180,
          fontWeight: 800,
          letterSpacing: -4,
          color: "#fff",
        }}
      >
        prompt<span style={{ color: "#a78bfa" }}>HUD</span>
      </div>
      <div
        style={{
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
          marginTop: 36,
          fontSize: 54,
          color: "#e2e8f0",
          fontWeight: 500,
          lineHeight: 1.3,
        }}
      >
        一眼看清每个 Claude Code<br />会话在哪一步
      </div>
      <div
        style={{
          opacity: painOpacity,
          marginTop: 72,
          fontSize: 36,
          color: "#94a3b8",
          lineHeight: 1.5,
        }}
      >
        3-5 个窗口来回切换？<br />不用再翻聊天记录了。
      </div>
    </AbsoluteFill>
  );
};
