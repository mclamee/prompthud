import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TitleCard } from "./scenes/TitleCard";
import { Demo } from "./scenes/Demo";
import { CTA } from "./scenes/CTA";

const FPS = 30;
const TITLE_SECONDS = 3;
const DEMO_SECONDS = 20;
const CTA_SECONDS = 5;

export const MAIN_DURATION_FRAMES = Math.round(
  (TITLE_SECONDS + DEMO_SECONDS + CTA_SECONDS) * FPS,
);

// Music: "Minimal Tech" by PaulYudin (Pixabay, royalty-free).
// Source: https://pixabay.com/music/corporate-minimal-tech-151890/
// Replace public/music.mp3 to swap tracks; set HAS_MUSIC=false to mute.
const HAS_MUSIC = true;

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
