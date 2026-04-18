import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Direction = "up" | "down";

interface Props {
  text: string;
  anchorX: number; // 0..1 fraction of screen width
  anchorY: number; // 0..1 fraction of screen height
  direction?: Direction;
}

/**
 * An animated callout label with a pointer arrow. Anchors to (anchorX, anchorY)
 * on the video frame; the label itself floats just above/below that point.
 */
export const Callout: React.FC<Props> = ({ text, anchorX, anchorY, direction = "up" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14 }, from: 0, to: 1 });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  const x = anchorX * width;
  const y = anchorY * height;
  const labelOffsetY = direction === "up" ? -80 : 80;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {/* Dot at the anchor */}
      <div
        style={{
          position: "absolute",
          left: x - 10,
          top: y - 10,
          width: 20,
          height: 20,
          borderRadius: 999,
          backgroundColor: "#a78bfa",
          opacity,
          boxShadow: "0 0 24px #a78bfa88",
          transform: `scale(${enter})`,
        }}
      />
      {/* Pointer line */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y + (direction === "up" ? -60 : 20),
          width: 2,
          height: 40 * enter,
          backgroundColor: "#a78bfa",
          opacity,
        }}
      />
      {/* Label */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y + labelOffsetY,
          transform: `translate(-50%, -100%) scale(${enter})`,
          backgroundColor: "#1e1e2a",
          border: "2px solid #a78bfa",
          borderRadius: 12,
          padding: "14px 22px",
          color: "#fff",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 28,
          fontWeight: 500,
          opacity,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 32px rgba(167,139,250,0.3)",
        }}
      >
        {text}
      </div>
    </div>
  );
};
