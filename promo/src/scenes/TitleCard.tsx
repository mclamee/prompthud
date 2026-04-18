import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = spring({ frame, fps, config: { damping: 12 }, from: 30, to: 0 });
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const tagY = spring({ frame: frame - 6, fps, config: { damping: 12 }, from: 20, to: 0 });
  const tagOpacity = interpolate(frame, [6, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(ellipse at center, #1a1a24 0%, #0d0d12 70%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 160,
          fontWeight: 800,
          letterSpacing: -4,
          color: "#fff",
        }}
      >
        prompt<span style={{ color: "#a78bfa" }}>hud</span>
      </div>
      <div
        style={{
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
          marginTop: 24,
          fontSize: 42,
          color: "#94a3b8",
          fontWeight: 400,
        }}
      >
        Know every session at a glance.
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 48,
          fontSize: 22,
          color: "#475569",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        A Claude Code statusline plugin
      </div>
    </AbsoluteFill>
  );
};
