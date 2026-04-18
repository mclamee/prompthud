import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Vertical-friendly terminal mock for the CN promo. Compared to FakeTerminal
// (landscape), this is tuned for 1080×1920 phone viewing:
//   - larger fontSize (28–36 vs 22–24)
//   - narrower HUD budget (60 chars vs 108) so 2-line layout kicks in
//   - fewer stream lines visible at once; older rows scroll off fast
//   - all user-facing Chinese kept out of the terminal itself (real devs
//     see English log output), Chinese lives in overlays and callouts

const PROMPTS = [
  "fix the login redirect bug",        // 0
  "add jwt refresh token",             // 1
  "why is the cookie not being set",   // 2
  "why is the cookie not being set",   // 3 → ×2
  "debug token rotation race",         // 4
  "debug token rotation race",         // 5 → ×2
  "debug token rotation race",         // 6 → ×3
  "/test",                             // 7
  "/code-review",                      // 8
  "/commit",                           // 9
];

const RESPONSES: string[][] = [
  ["Reading src/auth/middleware.ts…", "Patching redirect on line 42", "✓ 3 passed"],
  ["Edit src/auth/refresh.ts (+28 −4)", "+ export async rotate(token)", "✓ 8 passed"],
  ["Inspecting Set-Cookie…", "SameSite=Strict blocks cross-site", "Applying Lax…"],
  ["Checking nginx config…", "proxy_cookie_path strips domain", "✓ cookie persists"],
  ["Two concurrent rotate() calls", "Logging timestamps…", "Reproduced 3/10 runs"],
  ["Added mutex around rotate", "✗ deadlock after 200 iters"],
  ["Rewriting with idempotent IDs", "+ if (tokenId === last) return", "✓ 10/10 pass"],
  ["$ pnpm test", "Tests: 24 passed, 0 failed"],
  ["5 files changed · LGTM"],
  ["[main a1b2c3d] feat(auth)", "6 files · +72 −12", "Pushed to origin/main"],
];

const LINES_PER_SEC = 3.2;
const LINE_HEIGHT = 46;
const VISIBLE_ROWS = 5;

const HUD_TARGET_CHARS = 60;
const MAX_CMD_CHARS = 22;

type Run = { lastIdx: number; text: string; count: number };

function collapseRuns(visible: string[]): Run[] {
  if (!visible.length) return [];
  const out: Run[] = [];
  let cur = visible[0], idx = 0, n = 1;
  for (let i = 1; i < visible.length; i++) {
    if (visible[i] === cur) { idx = i; n += 1; }
    else { out.push({ lastIdx: idx, text: cur, count: n }); cur = visible[i]; idx = i; n = 1; }
  }
  out.push({ lastIdx: idx, text: cur, count: n });
  return out;
}

function trunc(s: string): string {
  return s.length > MAX_CMD_CHARS ? s.slice(0, MAX_CMD_CHARS - 1) + "…" : s;
}

type StreamLine = { kind: "prompt" | "response"; text: string };

const ALL_STREAM: StreamLine[] = (() => {
  const out: StreamLine[] = [];
  PROMPTS.forEach((p, i) => {
    out.push({ kind: "prompt", text: p });
    RESPONSES[i].forEach((r) => out.push({ kind: "response", text: r }));
  });
  return out;
})();

export const VerticalTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const continuousRevealed = (frame * LINES_PER_SEC) / fps;
  const revealedCount = Math.min(ALL_STREAM.length, Math.floor(continuousRevealed) + 1);
  const revealed = ALL_STREAM.slice(0, revealedCount);
  const visiblePrompts = revealed.filter((l) => l.kind === "prompt").map((l) => l.text);
  const visibleCount = visiblePrompts.length;

  const hiddenRows = Math.max(0, continuousRevealed - VISIBLE_ROWS);
  const translateY = -hiddenRows * LINE_HEIGHT;

  // Pack runs into a 2-line HUD with the current on line 2
  const runs = collapseRuns(visiblePrompts);
  const currentRun = runs[runs.length - 1];
  const pastRuns = runs.slice(0, -1);

  const hudOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Right-to-left pack past runs into HUD line 1 budget
  const isDup = visibleCount >= 2 && visiblePrompts[visibleCount - 1] === visiblePrompts[visibleCount - 2];
  const pulseStart = isDup ? (visibleCount - 1) * (fps / (LINES_PER_SEC / 4)) : -1000;
  const pulse = interpolate(frame - pulseStart, [0, 6, 18], [1, 1.3, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const headerPlain = `☰ ${visibleCount}`;
  const sepLen = 3; // " | "
  let remainingChars = HUD_TARGET_CHARS - headerPlain.length;
  const fittedPast: Run[] = [];
  for (let i = pastRuns.length - 1; i >= 0; i--) {
    const r = pastRuns[i];
    const t = trunc(r.text);
    const suf = r.count > 1 ? ` ×${r.count}` : "";
    const piece = `${r.lastIdx + 1}.${t}${suf}`;
    const tailCost = i > 0 ? ` (+${i} more)`.length : 0;
    const needed = sepLen + piece.length + tailCost;
    if (remainingChars < needed) break;
    remainingChars -= sepLen + piece.length;
    fittedPast.unshift({ lastIdx: r.lastIdx, text: t, count: r.count });
  }
  const hiddenCount = pastRuns.length - fittedPast.length;

  // Currently-typed (next prompt)
  const nextIdx = Math.min(PROMPTS.length - 1, visibleCount);
  const typedPrompt = PROMPTS[nextIdx];

  return (
    <div
      style={{
        position: "absolute",
        inset: 40,
        top: 20,
        backgroundColor: "#141420",
        borderRadius: 24,
        border: "1px solid #2a2a3a",
        padding: 0,
        fontFamily: "'JetBrains Mono', Menlo, monospace",
        color: "#cbd5e1",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Window chrome */}
      <div style={{ display: "flex", gap: 12, padding: "22px 32px", borderBottom: "1px solid #2a2a3a" }}>
        {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
          <div key={c} style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: c }} />
        ))}
        <div style={{ color: "#64748b", marginLeft: 18, fontSize: 24 }}>~ claude code session</div>
      </div>

      {/* Transcript — muted, scrolling */}
      <div
        style={{
          flex: 1,
          padding: "28px 32px",
          overflow: "hidden",
          position: "relative",
          opacity: 0.4,
          fontSize: 28,
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 15%, black 30%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 15%, black 30%)",
        }}
      >
        <div style={{ transform: `translateY(${translateY}px)`, willChange: "transform" }}>
          {revealed.map((line, i) => (
            <div
              key={i}
              style={{
                height: LINE_HEIGHT,
                lineHeight: `${LINE_HEIGHT}px`,
                color: line.kind === "prompt" ? "#a78bfa" : "#475569",
                fontWeight: line.kind === "prompt" ? 600 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {line.kind === "prompt" ? `> ${line.text}` : line.text}
            </div>
          ))}
        </div>
      </div>

      {/* Input row (bracketed top + bottom) */}
      <div
        style={{
          padding: "20px 32px",
          borderTop: "1px solid #2a2a3a",
          borderBottom: "1px solid #2a2a3a",
          color: "#64748b",
          fontSize: 28,
          opacity: 0.55,
          minHeight: 68,
        }}
      >
        <span>&gt; {typedPrompt}</span>
        <span style={{ opacity: Math.sin(frame / 4) > 0 ? 1 : 0, color: "#a78bfa" }}>▍</span>
      </div>

      {/* HUD — the hero, 2-line, large, glowing */}
      <div
        style={{
          opacity: hudOpacity,
          backgroundColor: "#15152a",
          borderTop: "3px solid #7c3aed",
          boxShadow: "0 -24px 80px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(167, 139, 250, 0.25)",
          padding: "28px 32px 36px",
          fontSize: 30,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {/* Line 1: header + past runs */}
        <div style={{ marginBottom: 14, whiteSpace: "nowrap" }}>
          <span style={{ color: "#c084fc", fontWeight: 700 }}>{headerPlain}</span>
          {hiddenCount > 0 && <span style={{ color: "#64748b" }}> (+{hiddenCount} more)</span>}
          {fittedPast.map((p) => (
            <span key={`${p.lastIdx}-${p.count}`}>
              <span style={{ color: "#475569" }}> | </span>
              <span style={{ color: "#64748b" }}>{p.lastIdx + 1}.</span>
              <span style={{ color: "#67e8f9" }}>{p.text}</span>
              {p.count > 1 && <span style={{ color: "#f472b6", marginLeft: 8 }}>×{p.count}</span>}
            </span>
          ))}
        </div>
        {/* Line 2: current (always visible) */}
        {currentRun && (
          <div style={{ whiteSpace: "nowrap" }}>
            <span style={{ color: "#86efac", fontWeight: 700 }}>
              ▶ {currentRun.lastIdx + 1}.{trunc(currentRun.text)}
            </span>
            {currentRun.count > 1 && (
              <span
                style={{
                  color: "#f472b6",
                  fontWeight: 700,
                  marginLeft: 12,
                  display: "inline-block",
                  transform: `scale(${pulse})`,
                  transformOrigin: "center",
                }}
              >
                ×{currentRun.count}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
