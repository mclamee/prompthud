import { AbsoluteFill, Sequence } from "remotion";
import { TitleCard } from "./scenes/TitleCard";
import { Demo } from "./scenes/Demo";
import { CTA } from "./scenes/CTA";

const FPS = 30;
const TITLE_SECONDS = 4;
const DEMO_SECONDS = 35;
const CTA_SECONDS = 6;

export const MAIN_DURATION_FRAMES =
  (TITLE_SECONDS + DEMO_SECONDS + CTA_SECONDS) * FPS;

export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d12" }}>
      <Sequence durationInFrames={TITLE_SECONDS * FPS}>
        <TitleCard />
      </Sequence>
      <Sequence
        from={TITLE_SECONDS * FPS}
        durationInFrames={DEMO_SECONDS * FPS}
      >
        <Demo />
      </Sequence>
      <Sequence from={(TITLE_SECONDS + DEMO_SECONDS) * FPS}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
