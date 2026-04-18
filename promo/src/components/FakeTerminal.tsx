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

// Three-act arc: iterate on bug → debug → finalize
const PROMPTS = [
  "fix the login redirect bug",
  "fix the login redirect bug",         // ×2
  "add jwt refresh token handling",
  "why is the cookie not being set",
  "why is the cookie not being set",    // ×2
  "why is the cookie not being set",    // ×3
  "add remember-me checkbox to form",
  "/test",
  "/code-review",
  "/commit",
];

// Per-prompt fake response lines. Deterministic so renders are reproducible.
// Feel: log lines, code diff, Read/Edit tool output, test summary.
const RESPONSE_POOL: string[][] = [
  ["Reading src/auth/middleware.ts…", "Found redirect on line 42", "Patching: res.redirect(returnTo)", "Running tests…", "✓ 3 passed"],
  ["Still reproducing — trace says cookie domain mismatch", "Reading src/config/cookies.ts…", "Domain set to .local — missing in prod env", "Adding COOKIE_DOMAIN override", "✓ redeployed"],
  ["Edit src/auth/refresh.ts (+28 −4)", "Generated types/refresh.d.ts", "+ export async function rotate(token: string)", "+   const claims = await verify(token);", "Running auth.spec.ts → 12 passed"],
  ["Inspecting Set-Cookie header in response…", "Header present but SameSite=Strict blocks cross-site", "Reading src/server/session.ts…", "Suggestion: change to SameSite=Lax", "Applying…"],
  ["Still failing — checking production nginx config", "Reading infra/nginx.conf…", "proxy_cookie_path rewrites strip domain", "Patching nginx rules", "Reload: nginx -s reload"],
  ["One more iteration — checking Safari ITP behaviour", "Third-party cookie policy blocks load", "Reading src/auth/third-party.ts…", "Falling back to first-party fetch", "✓ Safari now receives cookie"],
  ["Edit src/auth/login-form.tsx (+14 −2)", "+ <input type='checkbox' name='remember' />", "+ const remember = formData.get('remember')", "Bumping session TTL when remember=true", "✓ e2e remember.spec.ts passes"],
  ["$ pnpm test", "  auth.spec.ts    ✓ 12 passed", "  session.spec.ts ✓ 8 passed", "  remember.spec.ts ✓ 3 passed", "Tests: 23 passed, 0 failed"],
  ["Reviewing diff across 6 files…", "src/auth/middleware.ts   +4 −2", "src/auth/refresh.ts      +28 −4", "src/auth/login-form.tsx  +14 −2", "LGTM — ready to ship"],
  ["$ git add -A && git commit", "[main a1b2c3d] feat(auth): refresh + remember-me", " 6 files changed, 72 insertions(+), 12 deletions(-)", "$ git push", "Pushed to origin/main"],
];

const LINES_PER_SEC = 5.5; // matches 1.1 prompts/s × ~5 lines each

// ──────────────────────────────────────────────────────────────────────────
// HUD packing (real prompthud behaviour)
// ──────────────────────────────────────────────────────────────────────────
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

      {/* Transcript — scrolls as new lines arrive, older prompts get pushed off the top. */}
      <div
        style={{
          flex: 1,
          padding: "20px 30px",
          overflow: "hidden",
          position: "relative",
          minHeight: TRANSCRIPT_HEIGHT,
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
                    color: line.text.startsWith("/") ? "#fbbf24" : "#a78bfa",
                    fontWeight: 700,
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
                  color: "#64748b",
                  opacity: 0.85,
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* Input line — pinned at the bottom of the chat area */}
      <div
        style={{
          padding: "14px 30px",
          borderTop: "1px solid #1e1e2a",
          color: typedPrompt.startsWith("/") ? "#fbbf24" : "#cbd5e1",
          minHeight: 50,
        }}
      >
        &gt; <span style={{ opacity: 0.6 }}>{typedPrompt}</span>
        <span style={{ opacity: Math.sin(frame / 4) > 0 ? 1 : 0, color: "#a78bfa" }}>▍</span>
      </div>

      {/* HUD row — prompthud's contribution; every prompt stays visible here */}
      <div
        style={{
          opacity: hudOpacity,
          backgroundColor: "#0a0a12",
          borderTop: "2px solid #312e4a",
          padding: "16px 30px",
          fontSize: 20,
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
            <span style={{ color: p.text.startsWith("/") ? "#fbbf24" : "#67e8f9" }}>{p.text}</span>
            {p.count > 1 && <span style={{ color: "#f472b6", marginLeft: 6 }}>×{p.count}</span>}
          </span>
        ))}
        {current && (
          <span>
            <span style={{ color: "#475569" }}> | </span>
            <span style={{ color: current.text.startsWith("/") ? "#fbbf24" : "#86efac", fontWeight: 700 }}>
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
