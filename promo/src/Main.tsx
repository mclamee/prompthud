import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TitleCard } from "./scenes/TitleCard";
import { Demo } from "./scenes/Demo";
import { CTA } from "./scenes/CTA";

const FPS = 30;
const TITLE_SECONDS = 2.5;
const DEMO_SECONDS = 15;
const CTA_SECONDS = 3;

export const MAIN_DURATION_FRAMES = Math.round(
  (TITLE_SECONDS + DEMO_SECONDS + CTA_SECONDS) * FPS,
);

// Drop a loopable track at promo/public/music.mp3 then flip to true.
// Suggested: pixabay.com/music (tech/ambient), chosic.com (free lofi), uppbeat.io.
const HAS_MUSIC = false;

export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d12" }}>
      {HAS_MUSIC && (
        <Audio
          src={staticFile("music.mp3")}
          // Fade in 0.5s, full volume mid, fade out last 1s.
          volume={(f) => {
            const total = MAIN_DURATION_FRAMES;
            if (f < 15) return f / 15 * 0.5;
            if (f > total - 30) return Math.max(0, (total - f) / 30) * 0.5;
            return 0.5;
          }}
        />
      )}
      <Sequence durationInFrames={Math.round(TITLE_SECONDS * FPS)}>
        <TitleCard />
      </Sequence>
      <Sequence
        from={Math.round(TITLE_SECONDS * FPS)}
        durationInFrames={DEMO_SECONDS * FPS}
      >
        <Demo />
      </Sequence>
      <Sequence from={Math.round((TITLE_SECONDS + DEMO_SECONDS) * FPS)}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
