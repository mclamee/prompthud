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

      {/* Callouts timed to the FakeTerminal reveal pace (~1.1 prompts/sec).
           Story arc:   iterate → debug → finalize
             ~1s   prompt 2 is a dup  → "▶ live prompt"
             ~5s   ×3 lands           → "×N folds duplicates"
             ~9s   overflow kicks in  → "(+K more) hides the tail"
             ~12s  /commit lands      → "finish: /test → /review → /commit"  */}
      <Sequence from={FPS * 1.5} durationInFrames={FPS * 2.5}>
        <Callout text="▶ live prompt, always visible" anchorX={0.6} anchorY={0.82} direction="up" />
      </Sequence>

      <Sequence from={FPS * 5} durationInFrames={FPS * 2.5}>
        <Callout text="×N folds duplicates" anchorX={0.45} anchorY={0.82} direction="up" />
      </Sequence>

      <Sequence from={FPS * 8.5} durationInFrames={FPS * 2.5}>
        <Callout text="(+K more) hides the tail" anchorX={0.22} anchorY={0.82} direction="up" />
      </Sequence>

      <Sequence from={FPS * 12} durationInFrames={FPS * 3}>
        <Callout
          text="wrap up: /test → /review → /commit"
          anchorX={0.7}
          anchorY={0.82}
          direction="up"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
