# Changelog

All notable changes to prompthud are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] — 2026-04-18

### New
- **`/prompthud:wrap-claude-hud`** — captures the current `statusLine.command`
  verbatim (regardless of source) and wraps it so prompthud's full prompts row
  prints below its output. Black-box wrapping: no dependency on claude-hud's
  internals, runtime, or API. Survives arbitrary upstream upgrades.
- **Consecutive-duplicate folding** in both `statusline` and `list`: runs of
  the same prompt collapse into a single entry with `×N` suffix. The display
  number references the most recent occurrence, so `show N` still works.
- Re-added `render` subcommand (prompts row only) — used by the wrap flow.

### Fixed
- `statusline-wrapper.sh` exited early under `set -e` when `PROMPTHUD_DEBUG`
  wasn't set: `dbg()` returning non-zero killed the script. Added `return 0`
  and replaced `[ -n X ] && Y` with full `if ... fi`.

## [0.2.0] — 2026-04-18

Decouple prompthud from claude-hud's internals.

### Breaking changes
- **Removed** `claude-hud-row` and `claude-hud-inline` display modes. Both
  invoked claude-hud's entry point directly, which would break if claude-hud
  restructured its cache layout, entry file, or runtime. If you relied on
  these, see the new bridge flow below.
- **Removed** env vars `PROMPTHUD_MODE` and `PROMPTHUD_BUN` (no longer needed).

### New
- **`/prompthud:bridge-claude-hud`** — opt-in integration that uses claude-hud's
  **public `--extra-cmd` API only**. Injects prompthud's `label` subcommand
  into the existing claude-hud statusLine configuration; survives claude-hud
  upgrades as long as they keep honouring `--extra-cmd`.

### Other
- Wrapper fixed: `detect_cols` no longer causes `set -e` to exit when `/dev/tty`
  is unavailable (sandboxed subprocesses).

## [0.1.0] — 2026-04-18

Initial release.

### Features
- HUD statusline showing every prompt in the current session, live prompt highlighted (`▶`).
- Width-adaptive packing: greedy fill with CJK-aware cell-width measurement; auto single-/two-line layout based on current prompt length.
- `/prompthud:list` slash command for compact browsable table.
- `/prompthud:setup` slash command that writes a glob-based statusline command.
- Backfill from `~/.claude/history.jsonl` for sessions started before install.
- `UserPromptSubmit` hook logs each prompt to `~/.claude/prompthud/<session>.tsv` for fast reads.

### Requirements
- Python 3.8+ (stdlib only, no third-party packages)
