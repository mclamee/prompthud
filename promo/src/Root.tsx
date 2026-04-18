import { Composition } from "remotion";
import { Main, MAIN_DURATION_FRAMES } from "./Main";
import { TitleCard } from "./scenes/TitleCard";
import { Demo } from "./scenes/Demo";
import { CTA } from "./scenes/CTA";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={MAIN_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="TitleCard"
        component={TitleCard}
        durationInFrames={Math.round(FPS * 2.5)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={FPS * 15}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="CTA"
        component={CTA}
        durationInFrames={FPS * 3}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
