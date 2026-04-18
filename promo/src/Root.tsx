import { Composition } from "remotion";
import { Main, MAIN_DURATION_FRAMES } from "./Main";
import { MainCN, MAIN_CN_DURATION_FRAMES } from "./MainCN";
import { TitleCard } from "./scenes/TitleCard";
import { Demo } from "./scenes/Demo";
import { CTA } from "./scenes/CTA";
import { TitleCardCN } from "./scenes/TitleCardCN";
import { DemoCN } from "./scenes/DemoCN";
import { CTACN } from "./scenes/CTACN";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const V_WIDTH = 1080;
const V_HEIGHT = 1920;

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
        durationInFrames={FPS * 3}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={FPS * 20}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="CTA"
        component={CTA}
        durationInFrames={FPS * 5}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* Vertical 9:16 — 微信视频号 / 小红书 / 抖音 / TikTok */}
      <Composition
        id="MainCN"
        component={MainCN}
        durationInFrames={MAIN_CN_DURATION_FRAMES}
        fps={FPS}
        width={V_WIDTH}
        height={V_HEIGHT}
      />
      <Composition
        id="TitleCardCN"
        component={TitleCardCN}
        durationInFrames={FPS * 3}
        fps={FPS}
        width={V_WIDTH}
        height={V_HEIGHT}
      />
      <Composition
        id="DemoCN"
        component={DemoCN}
        durationInFrames={FPS * 17}
        fps={FPS}
        width={V_WIDTH}
        height={V_HEIGHT}
      />
      <Composition
        id="CTACN"
        component={CTACN}
        durationInFrames={FPS * 5}
        fps={FPS}
        width={V_WIDTH}
        height={V_HEIGHT}
      />
    </>
  );
};
