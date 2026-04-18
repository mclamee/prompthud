import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Fake terminal shown when no real recording exists yet.
// Simulates real prompthud packing: past prompts fill right-to-left, older
// ones collapse into `(+N more)` when they'd overflow; the ▶ current prompt
// is always pinned to the rightmost slot.
//
// Drop a real demo.mp4 into promo/public/ and set HAS_RECORDED_DEMO=true in
// scenes/Demo.tsx to swap this out.

const PROMPTS = [
  "fix the login redirect bug",
  "add jwt refresh token handling",
  "debug session persistence issue",
  "why is the cookie not being set",
  "add remember-me checkbox to form",
  "test the logout flow end-to-end",
  "handle expired refresh tokens gracefully",
  "add rate limiting to auth middleware",
  "write integration tests for auth",
  "deploy staging and smoke test",
];

// Pixel budget for the HUD row. Calibrated for a 1920px frame at fontSize 22.
const HUD_CHAR_WIDTH = 12; // mono 22px ≈ 12px/char
const HUD_TARGET_CHARS = 140; // ~ (1920 - 2*30 padding) / 12
const MAX_CMD_CHARS = 30; // mirrors prompthud's max_cmd_width

// Pack past prompts right-to-left into the budget. Older entries that don't
// fit become a single "(+N more)" token at the left.
function packHud(visible: string[]) {
  if (visible.length === 0) return { header: "", past: [] as { num: number; text: string }[], current: null as null | { num: number; text: string }, hidden: 0 };
  const total = visible.length;
  const current = { num: total, text: visible[total - 1] };
  const header = `☰ ${total}`;
  const sep = " | ";

  const curPrefix = `▶ ${current.num}.`;
  const curText = current.text.length > MAX_CMD_CHARS ? current.text.slice(0, MAX_CMD_CHARS - 1) + "…" : current.text;
  const curSpan = curPrefix.length + curText.length;

  let remaining = HUD_TARGET_CHARS - header.length - sep.length - curSpan;
  const past: { num: number; text: string }[] = [];
  let hidden = 0;

  // Walk past prompts from newest backward; stop when adding one would overflow.
  for (let i = total - 2; i >= 0; i--) {
    const text = visible[i];
    const shortText = text.length > MAX_CMD_CHARS ? text.slice(0, MAX_CMD_CHARS - 1) + "…" : text;
    const piece = `${i + 1}.${shortText}`;
    const hiddenAfter = i;
    const tailCost = hiddenAfter > 0 ? ` (+${hiddenAfter} more)`.length : 0;
    const needed = sep.length + piece.length + tailCost;
    if (remaining < needed) {
      hidden = i + 1;
      break;
    }
    remaining -= sep.length + piece.length;
    past.unshift({ num: i + 1, text: shortText });
  }
  return { header, past, current, hidden };
}

export const FakeTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Reveal prompts faster so all 10 appear by ~4s of the 15s demo.
  const revealPerFrame = 2.5 / fps;
  const visibleCount = Math.min(PROMPTS.length, 1 + Math.floor(frame * revealPerFrame));
  const visible = PROMPTS.slice(0, visibleCount);

  const hudOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const { header, past, current, hidden } = packHud(visible);

  return (
    <div
      style={{
        position: "absolute",
        inset: 80,
        top: 120,
        backgroundColor: "#141420",
        borderRadius: 16,
        border: "1px solid #2a2a3a",
        padding: 40,
        fontFamily: "'JetBrains Mono', 'Menlo', monospace",
        fontSize: 28,
        color: "#cbd5e1",
        overflow: "hidden",
      }}
    >
      {/* Faux window chrome */}
      <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
        {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
          <div key={c} style={{ width: 16, height: 16, borderRadius: 999, backgroundColor: c }} />
        ))}
        <div style={{ color: "#64748b", marginLeft: 16, fontSize: 22 }}>~ claude code session</div>
      </div>

      {/* Faux chat */}
      <div style={{ opacity: 0.6, lineHeight: 1.8 }}>
        <div style={{ color: "#64748b" }}>› streamed tokens…</div>
        <div style={{ color: "#64748b" }}>› streamed tokens…</div>
        <div style={{ color: "#64748b" }}>› ...</div>
      </div>

      {current && (
        <div style={{ marginTop: 40, color: "#a78bfa" }}>
          &gt; {current.text}
          <span style={{ opacity: Math.sin(frame / 4) > 0 ? 1 : 0 }}>▍</span>
        </div>
      )}

      {/* HUD row — greedy packing, current pinned right, overflow folds left. */}
      <div
        style={{
          opacity: hudOpacity,
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#0a0a12",
          borderTop: "1px solid #2a2a3a",
          padding: "22px 30px",
          fontSize: 22,
          color: "#cbd5e1",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span style={{ color: "#c084fc" }}>{header}</span>
        {hidden > 0 && (
          <span style={{ color: "#64748b" }}> (+{hidden} more)</span>
        )}
        {past.map((p) => (
          <span key={p.num}>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: "#64748b" }}>{p.num}.</span>
            <span style={{ color: "#67e8f9" }}>{p.text}</span>
          </span>
        ))}
        {current && (
          <span>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: "#86efac", fontWeight: 700 }}>
              ▶ {current.num}.{current.text}
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
