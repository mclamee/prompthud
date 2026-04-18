import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Callout } from "../components/Callout";
import { FakeTerminal } from "../components/FakeTerminal";

// Drop a recorded terminal session at promo/public/demo.mp4 to use the real
// recording. Until that file exists, we fall back to a scripted fake terminal
// so the project previews cleanly after `npm install`.
const HAS_RECORDED_DEMO = false;

const FPS = 30;

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d12", padding: 80 }}>
      <div style={{ position: "absolute", top: 40, left: 60, color: "#64748b", fontSize: 24, fontFamily: "'Inter', sans-serif" }}>
        Real session · {Math.floor(frame / FPS)}s / {Math.floor(durationInFrames / FPS)}s
      </div>

      {HAS_RECORDED_DEMO ? (
        <OffthreadVideo src={staticFile("demo.mp4")} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 16 }} />
      ) : (
        <FakeTerminal />
      )}

      {/* Scripted callouts — tweak the timing/positions to land on the moments in your recording. */}
      <Sequence from={FPS * 4} durationInFrames={FPS * 5}>
        <Callout
          text="▶ marks the live prompt"
          anchorX={0.55}
          anchorY={0.82}
          direction="up"
        />
      </Sequence>

      <Sequence from={FPS * 12} durationInFrames={FPS * 5}>
        <Callout
          text="Scroll-free history: last 20 prompts, always visible"
          anchorX={0.3}
          anchorY={0.82}
          direction="up"
        />
      </Sequence>

      <Sequence from={FPS * 22} durationInFrames={FPS * 6}>
        <Callout
          text="×N folds consecutive duplicates"
          anchorX={0.45}
          anchorY={0.82}
          direction="up"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
