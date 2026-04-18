import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Fake terminal matching real prompthud behaviour:
//   - past prompts pack right-to-left; overflow collapses into "(+K more)"
//   - the ▶ current prompt is always the rightmost slot
//   - consecutive identical prompts fold into a single "×N" entry — the
//     display number tracks the most-recent occurrence so `show N` still
//     addresses the last duplicate

// Intentional duplicates to showcase the ×N folding on screen.
const PROMPTS = [
  "fix the login redirect bug",
  "fix the login redirect bug",         // dup → ×2
  "add jwt refresh token handling",
  "debug session persistence",
  "why is the cookie not being set",
  "why is the cookie not being set",    // dup → ×2
  "why is the cookie not being set",    // dup → ×3
  "add remember-me checkbox to form",
  "write integration tests for auth",
  "deploy staging and smoke test",
];

const HUD_TARGET_CHARS = 140;
const MAX_CMD_CHARS = 30;

type Run = { lastIdx: number; text: string; count: number };

function collapseRuns(visible: string[]): Run[] {
  if (visible.length === 0) return [];
  const runs: Run[] = [];
  let curText = visible[0];
  let curLastIdx = 0;
  let curCount = 1;
  for (let i = 1; i < visible.length; i++) {
    if (visible[i] === curText) {
      curLastIdx = i;
      curCount += 1;
    } else {
      runs.push({ lastIdx: curLastIdx, text: curText, count: curCount });
      curText = visible[i];
      curLastIdx = i;
      curCount = 1;
    }
  }
  runs.push({ lastIdx: curLastIdx, text: curText, count: curCount });
  return runs;
}

function trunc(s: string): string {
  return s.length > MAX_CMD_CHARS ? s.slice(0, MAX_CMD_CHARS - 1) + "…" : s;
}

function packHud(visible: string[]) {
  const total = visible.length;
  const runs = collapseRuns(visible);
  if (runs.length === 0) {
    return { header: "", past: [] as Run[], current: null as null | Run, hidden: 0 };
  }
  const current = runs[runs.length - 1];
  const header = `☰ ${total}`;
  const sep = " | ";

  const curSuf = current.count > 1 ? ` ×${current.count}` : "";
  const curText = trunc(current.text);
  const curSpan = `▶ ${current.lastIdx + 1}.`.length + curText.length + curSuf.length;

  let remaining = HUD_TARGET_CHARS - header.length - sep.length - curSpan;
  const past: Run[] = [];
  let hidden = 0;

  for (let i = runs.length - 2; i >= 0; i--) {
    const r = runs[i];
    const shortText = trunc(r.text);
    const suf = r.count > 1 ? ` ×${r.count}` : "";
    const piece = `${r.lastIdx + 1}.${shortText}${suf}`;
    const hiddenAfter = i;
    const tailCost = hiddenAfter > 0 ? ` (+${hiddenAfter} more)`.length : 0;
    const needed = sep.length + piece.length + tailCost;
    if (remaining < needed) {
      hidden = i + 1;
      break;
    }
    remaining -= sep.length + piece.length;
    past.unshift({ lastIdx: r.lastIdx, text: shortText, count: r.count });
  }
  return { header, past, current: { ...current, text: curText }, hidden };
}

export const FakeTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ~1 prompt/sec so the viewer can register each change. All 10 reveal by
  // ~9s of the 15s demo, leaving ~6s of settle time at the end.
  const revealPerFrame = 1.1 / fps;
  const visibleCount = Math.min(PROMPTS.length, 1 + Math.floor(frame * revealPerFrame));
  const visible = PROMPTS.slice(0, visibleCount);

  const hudOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  // When the most-recent added prompt is a duplicate, pulse the ×N counter
  // to draw the eye to the collapse behaviour.
  const isDup = visibleCount >= 2 && visible[visibleCount - 1] === visible[visibleCount - 2];
  const pulseStart = isDup ? (visibleCount - 1) * (fps / 1.1) : -1000;
  const pulse = interpolate(frame - pulseStart, [0, 6, 18], [1, 1.25, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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

      {/* HUD row */}
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
          <span key={`${p.lastIdx}-${p.count}`}>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: "#64748b" }}>{p.lastIdx + 1}.</span>
            <span style={{ color: "#67e8f9" }}>{p.text}</span>
            {p.count > 1 && (
              <span style={{ color: "#f472b6", marginLeft: 6 }}>×{p.count}</span>
            )}
          </span>
        ))}
        {current && (
          <span>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: "#86efac", fontWeight: 700 }}>
              ▶ {current.lastIdx + 1}.{current.text}
            </span>
            {current.count > 1 && (
              <span
                style={{
                  color: "#f472b6",
                  fontWeight: 700,
                  marginLeft: 8,
                  display: "inline-block",
                  transform: `scale(${pulse})`,
                  transformOrigin: "center",
                }}
              >
                ×{current.count}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};
