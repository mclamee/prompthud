# prompthud promo video

Remotion project for the prompthud launch video.

## Quick start

```bash
cd promo
npm install          # or pnpm install
npm run dev          # opens Remotion Studio at http://localhost:3000
```

Open the `Main` composition (60s, 1920×1080). Individual scenes (`TitleCard`,
`Demo`, `CTA`) are also registered so you can iterate on them alone.

## Record the real demo

The `Demo` scene uses a scripted `FakeTerminal` by default so the project
previews cleanly on first install. To swap in a real session recording:

```bash
brew install asciinema agg   # or your package manager
asciinema rec demo.cast      # run a real Claude Code session; keep it ≤35s
agg demo.cast demo.gif       # → gif (or pipe to ffmpeg for mp4)
# Or use QuickTime screen recording directly:
#   Cmd+Shift+5 → Record Selected Portion → export as demo.mov, then
#   ffmpeg -i demo.mov -c:v libx264 -crf 20 promo/public/demo.mp4
```

Then in `src/scenes/Demo.tsx` flip:

```ts
const HAS_RECORDED_DEMO = true;
```

Adjust the `<Callout>` timings in the same file to land on the moments you
want to highlight (▶ marker appearing, duplicate folding, wide-terminal
two-line layout, etc.).

## Render

```bash
npm run render        # → out/prompthud-promo.mp4
npm run render:gif    # → out/prompthud-promo.gif
```

Or render a single scene:

```bash
npx remotion render TitleCard out/title.mp4
```

## Scene layout (20.5s total)

| From | Duration | Scene | What happens |
|------|----------|-------|--------------|
| 0s | 2.5s | `TitleCard` | Logo fade-in + tagline |
| 2.5s | 15s | `Demo` | Real/fake terminal with 3 animated callouts |
| 17.5s | 3s | `CTA` | Install command + GitHub URL |

## Background music

The project ships with `HAS_MUSIC = true` pointing at `public/music.mp3`,
which is **gitignored** per Pixabay's redistribution terms. To reproduce the
reference video, download:

- "Minimal Tech" by PaulYudin — https://pixabay.com/music/corporate-minimal-tech-151890/

Save as `public/music.mp3`. The track auto-fades in (0.5s) and out (1s).
To use a different track, just replace the file. To mute entirely, flip
`HAS_MUSIC = false` in `src/Main.tsx`.

Free sources:
- [pixabay.com/music](https://pixabay.com/music/) — filter by genre "tech / ambient"
- [chosic.com/free-music/all](https://www.chosic.com/free-music/all/) — good lofi / minimal
- [YouTube Audio Library](https://studio.youtube.com/channel/UC.../music) — sign in with any Google account
- [uppbeat.io](https://uppbeat.io/) — free with attribution

## Asset checklist

- `public/demo.mp4` — real terminal recording (optional but recommended)
- Optional: a custom font via `@remotion/google-fonts` for Inter + JetBrains Mono
- Optional: intro/outro audio loops in `public/audio/`

## Notes

- Remotion 4 uses React 18. If you upgrade React, keep `react` and
  `react-dom` on the same major as Remotion.
- `remotion.config.ts` sets `concurrency: 1` to avoid OOM on laptops; bump
  it on a render server.
- Fonts: the scenes reference system `Inter` / `JetBrains Mono`. Install
  `@remotion/google-fonts` if you want deterministic font rendering across
  machines.
