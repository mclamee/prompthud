# promptHUD

**Know every Claude Code session at a glance.**

<video src="https://github.com/mclamee/prompthud/releases/latest/download/prompthud-promo.mp4" controls muted loop width="100%">
  Your browser can't play the inline video —
  <a href="https://github.com/mclamee/prompthud/releases/latest">download the 28s promo</a>.
</video>

## Why

You're juggling 3-5 Claude Code windows. Cmd-Tab into one five minutes later
and you need 30 seconds of scrolling to remember what it was even doing.
`promptHUD` pins the answer to the statusline — every session tells you
where it stands in one glance, without touching the chat.

![promptHUD statusline example](docs/hud-example.svg)

## Install

```
/plugin marketplace add mclamee/prompthud
/plugin install prompthud@prompthud
/prompthud:setup     # wires the statusline into ~/.claude/settings.json
/reload-plugins
```

Two steps: register the marketplace, then install from it. `/prompthud:setup` writes a
glob-based statusline command so plugin upgrades don't break the path.

## Slash commands

| Command | What it does |
|---------|--------------|
| `/prompthud:setup` | Install the prompthud statusline into `~/.claude/settings.json` |
| `/prompthud:bridge-claude-hud` | Bridge any existing statusLine (claude-hud, etc.) so the prompts row prints below it (treats the base as a black box) |

## Configuration

Set as env-prefix on the statusLine command in `~/.claude/settings.json`:

- `PROMPTHUD_LINES=1|2|auto` — force cmds row count (default `auto`: long prompts go two-line)
- `PROMPTHUD_COMPACT=1` — drop model/git/ctx header row, keep only the cmds row
- `PROMPTHUD_DEBUG=1` — log diagnostics to `$CLAUDE_CONFIG_DIR/prompthud/debug.log` (defaults to `~/.claude/prompthud/debug.log`)

`/prompthud:setup` preserves any of the above env-prefix you had set, so re-running it keeps your config.

## Running alongside another statusline plugin

Claude Code's `statusLine` slot takes one command. Use `/prompthud:bridge-claude-hud` after
whatever other setup you already ran:

```
/claude-hud:setup           # or any other statusline plugin's setup
/prompthud:bridge-claude-hud
```

It captures the current `statusLine.command` string verbatim into
`$CLAUDE_CONFIG_DIR/prompthud/base.sh`, then rewrites the statusLine to run that base
first and the prompts row second. We treat the base as a **black box** — no dependency
on paths, runtimes, or internal APIs. Works for any statusline plugin whose command
reads Claude Code's JSON from stdin and prints to stdout.

Trade-off: uses an extra row. Re-running the upstream setup overwrites the bridge;
re-run `/prompthud:bridge-claude-hud` to re-capture.

### Revert

Run `/claude-hud:setup` (or `/prompthud:setup`) — both reset the statusLine cleanly.

## Requirements

- Python 3 (macOS has it by default; Linux: install `python3` package)

## Data locations

- Per-session log: `$CLAUDE_CONFIG_DIR/prompthud/<session-id>.tsv` (defaults to `~/.claude/prompthud/`)
- Backfill source (pre-install sessions): `$CLAUDE_CONFIG_DIR/history.jsonl`

## License

MIT
