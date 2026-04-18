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

      {/* Callouts land where the feature actually renders on the HUD line.
           Anchor reference (frame 1920 wide, HUD content starts at x≈110):
             • ▶ current prompt:  right-aligned end of line  → x≈0.70
             • ×N badge:          tail of current prompt     → x≈0.72
             • (+K more) tag:     just after "☰ N" header    → x≈0.14
             • /commit current:   right-aligned end of line  → x≈0.68
           Story arc:
             0-3s   baseline: 4 plain prompts — no features yet
             ~3.6s  prompt 5 is first dup → ×2 badge pulses in
             ~4.5s  prompt 6 is dup → ×3 pulses
             ~7-9s  overflow triggers (+K more)
             ~9s    /commit lands                                          */}

      {/* 1. basic HUD (before any feature appears) */}
      <Sequence from={FPS * 1.5} durationInFrames={FPS * 2}>
        <Callout text="▶ live prompt, always visible" anchorX={0.70} anchorY={0.82} direction="up" />
      </Sequence>

      {/* 2. ×N — fires right after the ×3 pulse lands */}
      <Sequence from={FPS * 5} durationInFrames={FPS * 2.5}>
        <Callout text="×N folds duplicates" anchorX={0.72} anchorY={0.82} direction="up" />
      </Sequence>

      {/* 3. (+K more) — anchor near the left of HUD where the tag renders */}
      <Sequence from={FPS * 8.5} durationInFrames={FPS * 2.5}>
        <Callout text="(+K more) hides the tail" anchorX={0.14} anchorY={0.82} direction="up" />
      </Sequence>

      {/* 4. final message — /commit visible on the right */}
      <Sequence from={FPS * 12} durationInFrames={FPS * 3}>
        <Callout
          text="every prompt preserved, even /commit"
          anchorX={0.68}
          anchorY={0.82}
          direction="up"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
