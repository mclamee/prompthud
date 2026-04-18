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

      {/* Callouts centered horizontally (anchor 0.55) for visual balance —
         the HUD is the horizontal bar the viewer's eye is already on, so
         pointing "at the bar" from center reads cleanly without the label
         drifting off to one side.
         Timing retuned for the new reveal pace (~0.8 prompts/s):
             0-3s     baseline prompts 1-3
            ~3.75s    prompt 4 → Group A ×2 appears
            ~5-7.5s   prompts 5-7 → Group B grows to ×3
            ~8.75s    /test
            ~10s      /code-review
            ~11.25s   /commit lands
           Callouts:
             1.5s     ▶ live prompt
             7.5s     ×N folds duplicates (both groups visible)
            12s       every prompt preserved                                        */}

      <Sequence from={FPS * 1.5} durationInFrames={FPS * 2.5}>
        <Callout text="▶ live prompt, always visible" anchorX={0.55} anchorY={0.82} direction="up" />
      </Sequence>

      <Sequence from={FPS * 7.5} durationInFrames={FPS * 3}>
        <Callout text="×N folds duplicates" anchorX={0.55} anchorY={0.82} direction="up" />
      </Sequence>

      <Sequence from={FPS * 12} durationInFrames={FPS * 3}>
        <Callout
          text="every prompt preserved, even /commit"
          anchorX={0.55}
          anchorY={0.82}
          direction="up"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
