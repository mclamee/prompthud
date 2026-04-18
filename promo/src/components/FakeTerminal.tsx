import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Fake terminal that mirrors how Claude Code actually feels:
//   1. Transcript area (top): streamed fake output + user prompts. As more
//      lines arrive, older lines — including earlier user prompts — scroll
//      off the top. This is THE problem prompthud solves.
//   2. Input row (middle): the currently-being-typed prompt, pinned at the
//      bottom of the chat area (like the real TUI input line).
//   3. HUD row (bottom): the prompthud statusline — every prompt stays
//      visible, ▶ marks the live one, (+K more) hides overflow, ×N folds
//      consecutive duplicates.
//
// Drop a real demo.mp4 into promo/public/ and set HAS_RECORDED_DEMO=true in
// scenes/Demo.tsx to swap this out for the real recording.

// Progressive reveal — one feature per beat, and showing ×N TWICE so the
// pattern becomes obvious ("oh, this happens every time the user retries"):
//   beats 0-2  (~0-2s)   plain ascending prompts → learn the basic HUD
//   beats 3-4  (~2.7-3.6s)  dup group A → first ×2 appearance
//   beats 5-7  (~4.5-6.4s)  dup group B → second ×N, escalates to ×3
//   beats 7-9  (~6.4-8.2s)  slash commands → finalize arc
//                            + overflow triggers (+K more) along the way
const PROMPTS = [
  "fix the login redirect bug",            // 0 — baseline
  "add jwt refresh token handling",        // 1
  "why is the cookie not being set",       // 2
  "why is the cookie not being set",       // 3 → GROUP A ×2
  "debug token rotation race",             // 4 — new topic
  "debug token rotation race",             // 5 → GROUP B starts ×2
  "debug token rotation race",             // 6 → GROUP B ×3
  "/test",                                 // 7 — finalize begins
  "/code-review",                          // 8
  "/commit",                               // 9
];

// Per-prompt fake response lines — aligned with the new PROMPTS order.
const RESPONSE_POOL: string[][] = [
  // 0 fix login redirect
  ["Reading src/auth/middleware.ts…", "Found redirect on line 42", "Patching: res.redirect(returnTo)", "Running auth.spec.ts…", "✓ 3 passed"],
  // 1 add jwt refresh
  ["Edit src/auth/refresh.ts (+28 −4)", "Generated types/refresh.d.ts", "+ export async function rotate(token: string)", "+   const claims = await verify(token);", "✓ rotate.spec.ts 8 passed"],
  // 2 why cookie not set — first try
  ["Inspecting Set-Cookie header in response…", "Header present but SameSite=Strict blocks cross-site", "Reading src/server/session.ts…", "Changing to SameSite=Lax", "Redeploying…"],
  // 3 why cookie dup — different angle
  ["Still reproducing — checking nginx config", "Reading infra/nginx.conf…", "proxy_cookie_path rewrites strip domain", "Patching nginx rules + reload", "✓ cookie now persisted across requests"],
  // 4 debug token rotation race — first pass
  ["Reading src/auth/refresh.ts…", "Two concurrent requests both call rotate()", "One invalidates the other mid-flight", "Logging entry/exit timestamps…", "Reproduced 3/10 runs"],
  // 5 debug token rotation dup — mutex attempt
  ["Trying a mutex around the rotate call…", "Edit src/auth/refresh.ts (+12 −3)", "+ const unlock = await mu.acquire();", "Running stress.spec.ts…", "✗ deadlock after 200 iterations"],
  // 6 debug token rotation dup ×3 — final fix
  ["Rethinking — use idempotent token IDs instead", "Edit src/auth/refresh.ts (+18 −8)", "+ if (tokenId === lastIssued) return cached;", "Running stress.spec.ts…", "✓ 10/10 runs pass"],
  // 7 /test
  ["$ pnpm test", "  auth.spec.ts     ✓ 12 passed", "  refresh.spec.ts  ✓ 8 passed", "  stress.spec.ts   ✓ 4 passed", "Tests: 24 passed, 0 failed"],
  // 8 /code-review
  ["Reviewing diff across 5 files…", "src/auth/middleware.ts   +4 −2", "src/auth/refresh.ts      +46 −12", "infra/nginx.conf         +3 −1", "LGTM — ready to ship"],
  // 9 /commit
  ["$ git add -A && git commit", "[main a1b2c3d] feat(auth): refresh + token race fix", " 5 files changed, 61 insertions(+), 15 deletions(-)", "$ git push", "Pushed to origin/main"],
];

const LINES_PER_SEC = 4.0; // ~0.8 prompts/s — slow enough that viewers can
                           // read each baseline prompt before the next lands

// ──────────────────────────────────────────────────────────────────────────
// HUD packing (real prompthud behaviour)
// ──────────────────────────────────────────────────────────────────────────
// Budget calibration at fontSize 24 in a JetBrains Mono / Menlo fallback:
//   container: 1920 − 160 (outer inset) − 60 (HUD padding) = 1700 px
//   char:     24 × ~0.6 em ≈ 14.4 px → 1700 / 14.4 ≈ 118 chars max
// Use 108 for a safety buffer — some glyphs (e.g. ×, ▶) render slightly
// wider than a plain ASCII cell on macOS.
const HUD_TARGET_CHARS = 108;
const MAX_CMD_CHARS = 26;

type Run = { lastIdx: number; text: string; count: number };

function collapseRuns(visible: string[]): Run[] {
  if (visible.length === 0) return [];
  const runs: Run[] = [];
  let curText = visible[0];
  let curLastIdx = 0;
  let curCount = 1;
  for (let i = 1; i < visible.length; i++) {
    if (visible[i] === curText) { curLastIdx = i; curCount += 1; }
    else { runs.push({ lastIdx: curLastIdx, text: curText, count: curCount }); curText = visible[i]; curLastIdx = i; curCount = 1; }
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
  if (runs.length === 0) return { header: "", past: [] as Run[], current: null as Run | null, hidden: 0 };
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
    const tailCost = i > 0 ? ` (+${i} more)`.length : 0;
    const needed = sep.length + piece.length + tailCost;
    if (remaining < needed) { hidden = i + 1; break; }
    remaining -= sep.length + piece.length;
    past.unshift({ lastIdx: r.lastIdx, text: shortText, count: r.count });
  }
  return { header, past, current: { ...current, text: curText }, hidden };
}

// ──────────────────────────────────────────────────────────────────────────
// Transcript stream
// ──────────────────────────────────────────────────────────────────────────
type StreamLine =
  | { kind: "prompt"; text: string; promptIdx: number }
  | { kind: "response"; text: string };

function buildStream(prompts: string[]): StreamLine[] {
  const out: StreamLine[] = [];
  prompts.forEach((p, i) => {
    out.push({ kind: "prompt", text: p, promptIdx: i });
    const resp = RESPONSE_POOL[i % RESPONSE_POOL.length];
    resp.forEach((r) => out.push({ kind: "response", text: r }));
  });
  return out;
}

const ALL_STREAM = buildStream(PROMPTS);
const LINE_HEIGHT = 36;
const TRANSCRIPT_HEIGHT = 380;
const VISIBLE_ROWS = Math.floor(TRANSCRIPT_HEIGHT / LINE_HEIGHT);

export const FakeTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Continuous reveal progress drives a smooth translateY; integer count
  // drives which lines are actually rendered. Each frame is a snapshot in
  // Remotion — CSS transitions don't carry across frames, so scroll must be
  // a pure function of `frame`.
  const continuousRevealed = (frame * LINES_PER_SEC) / fps;
  const revealedLineCount = Math.min(ALL_STREAM.length, Math.floor(continuousRevealed) + 1);
  const revealedLines = ALL_STREAM.slice(0, revealedLineCount);

  const visiblePrompts = revealedLines.filter((l): l is Extract<StreamLine, { kind: "prompt" }> => l.kind === "prompt").map((l) => l.text);
  const visibleCount = visiblePrompts.length;

  // Scroll offset — interpolated so the transcript slides up continuously
  // rather than jumping line-by-line.
  const hiddenRows = Math.max(0, continuousRevealed - VISIBLE_ROWS);
  const translateY = -hiddenRows * LINE_HEIGHT;

  // HUD
  const hudOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const isDup = visibleCount >= 2 && visiblePrompts[visibleCount - 1] === visiblePrompts[visibleCount - 2];
  const pulseStart = isDup ? (visibleCount - 1) * (fps / 1.1) : -1000;
  const pulse = interpolate(frame - pulseStart, [0, 6, 18], [1, 1.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const { header, past, current, hidden } = packHud(visiblePrompts);

  // Currently-typed prompt (the next one about to land)
  const nextPromptIdx = Math.min(PROMPTS.length - 1, visibleCount);
  const typedPrompt = PROMPTS[nextPromptIdx] ?? "";

  return (
    <div
      style={{
        position: "absolute",
        inset: 80,
        top: 120,
        backgroundColor: "#141420",
        borderRadius: 16,
        border: "1px solid #2a2a3a",
        padding: 0,
        fontFamily: "'JetBrains Mono', 'Menlo', monospace",
        fontSize: 22,
        color: "#cbd5e1",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Window chrome */}
      <div style={{ display: "flex", gap: 10, padding: "20px 30px", borderBottom: "1px solid #2a2a3a" }}>
        {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: c }} />
        ))}
        <div style={{ color: "#64748b", marginLeft: 16, fontSize: 20 }}>~ claude code session</div>
      </div>

      {/* Transcript — deliberately muted to de-emphasise the "prompts scroll
         away" problem; the viewer's eye should land on the HUD below. */}
      <div
        style={{
          flex: 1,
          padding: "20px 30px",
          overflow: "hidden",
          position: "relative",
          minHeight: TRANSCRIPT_HEIGHT,
          opacity: 0.4,
          // Fade the top ~30% of the transcript into the background so scrolled
          // lines visibly dissolve rather than hard-clipping at the edge.
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 18%, black 35%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 18%, black 35%)",
        }}
      >
        <div style={{ transform: `translateY(${translateY}px)`, willChange: "transform" }}>
          {revealedLines.map((line, i) => {
            if (line.kind === "prompt") {
              return (
                <div
                  key={`p-${i}`}
                  style={{
                    height: LINE_HEIGHT,
                    lineHeight: `${LINE_HEIGHT}px`,
                    color: "#a78bfa",
                    fontWeight: 600,
                  }}
                >
                  &gt; {line.text}
                </div>
              );
            }
            return (
              <div
                key={`r-${i}`}
                style={{
                  height: LINE_HEIGHT,
                  lineHeight: `${LINE_HEIGHT}px`,
                  color: "#475569",
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* Input line — also muted; it's context, not the hero. */}
      <div
        style={{
          padding: "14px 30px",
          borderTop: "1px solid #1e1e2a",
          color: "#64748b",
          minHeight: 50,
          opacity: 0.55,
        }}
      >
        &gt; <span>{typedPrompt}</span>
        <span style={{ opacity: Math.sin(frame / 4) > 0 ? 1 : 0, color: "#a78bfa" }}>▍</span>
      </div>

      {/* HUD row — the hero. Brighter background, thicker glowing border,
         larger font so the eye naturally lands here. */}
      <div
        style={{
          opacity: hudOpacity,
          backgroundColor: "#15152a",
          borderTop: "2px solid #7c3aed",
          boxShadow: "0 -20px 60px rgba(124, 58, 237, 0.35), inset 0 1px 0 rgba(167, 139, 250, 0.25)",
          padding: "20px 30px",
          fontSize: 24,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span style={{ color: "#c084fc", fontWeight: 700 }}>{header}</span>
        {hidden > 0 && <span style={{ color: "#64748b" }}> (+{hidden} more)</span>}
        {past.map((p) => (
          <span key={`${p.lastIdx}-${p.count}`}>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: "#64748b" }}>{p.lastIdx + 1}.</span>
            <span style={{ color: "#67e8f9" }}>{p.text}</span>
            {p.count > 1 && <span style={{ color: "#f472b6", marginLeft: 6 }}>×{p.count}</span>}
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
