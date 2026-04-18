import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TitleCardCN } from "./scenes/TitleCardCN";
import { DemoCN } from "./scenes/DemoCN";
import { CTACN } from "./scenes/CTACN";

const FPS = 30;
const TITLE_SECONDS = 3;
const DEMO_SECONDS = 17;
const CTA_SECONDS = 5;

export const MAIN_CN_DURATION_FRAMES = Math.round(
  (TITLE_SECONDS + DEMO_SECONDS + CTA_SECONDS) * FPS,
);

const HAS_MUSIC = true;

export const MainCN: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d12" }}>
      {HAS_MUSIC && (
        <Audio
          src={staticFile("music.mp3")}
          volume={(f) => {
            const total = MAIN_CN_DURATION_FRAMES;
            if (f < 15) return (f / 15) * 0.5;
            if (f > total - 30) return Math.max(0, (total - f) / 30) * 0.5;
            return 0.5;
          }}
        />
      )}
      <Sequence durationInFrames={TITLE_SECONDS * FPS}>
        <TitleCardCN />
      </Sequence>
      <Sequence from={TITLE_SECONDS * FPS} durationInFrames={DEMO_SECONDS * FPS}>
        <DemoCN />
      </Sequence>
      <Sequence from={(TITLE_SECONDS + DEMO_SECONDS) * FPS}>
        <CTACN />
      </Sequence>
    </AbsoluteFill>
  );
};
