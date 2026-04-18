import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { VerticalTerminal } from "../components/VerticalTerminal";

const FPS = 30;

interface CalloutProps {
  text: string;
  subtitle?: string;
}

const CNCallout: React.FC<CalloutProps> = ({ text, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity,
        fontFamily: "'Inter', -apple-system, 'PingFang SC', sans-serif",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontSize: 52, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{text}</div>
      {subtitle && (
        <div style={{ fontSize: 30, color: "#94a3b8", marginTop: 12 }}>{subtitle}</div>
      )}
    </div>
  );
};

export const DemoCN: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d12" }}>
      <VerticalTerminal />

      {/* Callouts timed to VerticalTerminal reveal pace (~0.6 prompts/s):
          0-2s    "所有 prompt 固定在底部"
          2-6s    "当前在哪步？▶ 标出来"
          6-10s   "重复自动合并 ×N"
          10-14s  "/test /review /commit 都在"
          14-17s  closing                                                         */}
      <Sequence from={FPS * 1} durationInFrames={FPS * 4}>
        <CNCallout text="HUD 贴在状态栏底部" subtitle="不用翻聊天记录" />
      </Sequence>
      <Sequence from={FPS * 6} durationInFrames={FPS * 4}>
        <CNCallout text="重复追问自动折叠" subtitle="×N 一眼看出追问了几次" />
      </Sequence>
      <Sequence from={FPS * 11} durationInFrames={FPS * 5}>
        <CNCallout text="每条 prompt 都保留" subtitle="包括 /test · /commit 这些自定义命令" />
      </Sequence>
    </AbsoluteFill>
  );
};
