# prompthud

**HUD overlay for every prompt you sent in the current Claude Code session.**
Highlights the live one with `▶`, lets you browse history without scrolling the chat.

## Why

Claude Code sessions run long. 20 prompts in, you forget what you asked 10 minutes ago,
and scrolling back through streamed responses is painful. `prompthud` puts a compact
strip at the bottom of the terminal:

```
[Opus 4.7] │ dora git:(main*) │ ctx ████ 41%
☰ 27 (+23 more) | 24.fix login bug | 25.add cache | 26.refactor auth | ▶ 27.write tests
```

## Install

```
/plugin marketplace add mclamee/prompthud
/plugin install prompthud@prompthud
/prompthud:setup     # wires the statusline into ~/.claude/settings.json
/reload-plugins
```

That's it. The `/prompthud:setup` command writes a glob-based statusline command so
plugin upgrades don't break the path.

## Commands

| Command | What it does |
|---------|--------------|
| `/prompthud:list` | Compact table of all prompts in the current session |
| `/prompthud:setup` | Install the prompthud statusline into `~/.claude/settings.json` |
| `/prompthud:bridge-claude-hud` | Add our inline label to claude-hud's session line via its `--extra-cmd` API (compact, 50-char limit) |
| `/prompthud:wrap-claude-hud` | Wrap any existing statusLine so our **full prompts row** prints below it (treats the base as a black box) |

From `list`, reference a past prompt by number ("看 #3") and the CLI expands it:

```
session-cmds show 3    # full text of prompt 3
session-cmds tail 5    # last 5 prompts
session-cmds list --all
```

## Configuration

Set as env-prefix on the statusLine command in `~/.claude/settings.json`:

- `PROMPTHUD_LINES=1|2|auto` — force cmds row count (default `auto`: long prompts go two-line)
- `PROMPTHUD_COMPACT=1` — drop model/git/ctx header row, keep only the cmds row
- `PROMPTHUD_DEBUG=1` — log diagnostics to `$CLAUDE_CONFIG_DIR/prompthud/debug.log` (defaults to `~/.claude/prompthud/debug.log`)

`/prompthud:setup` preserves any of the above env-prefix you had set, so re-running it keeps your config.

## Running alongside another statusline plugin

Claude Code's `statusLine` slot takes one command. Two ways to co-exist:

### 1. `bridge` — inline label via claude-hud's public API

```
/claude-hud:setup
/prompthud:bridge-claude-hud
```

Injects `--extra-cmd` into claude-hud's invocation. claude-hud renders its full
HUD and calls our `label` subcommand for a tiny inline `☰ N ▶ current…` on its
session line. Zero extra rows, but limited to 50 chars (claude-hud's label cap).
Depends only on `--extra-cmd` being a stable API.

### 2. `wrap` — full prompts row below any existing statusline

```
/claude-hud:setup           # or any other statusline plugin's setup
/prompthud:wrap-claude-hud
```

Captures the current `statusLine.command` string verbatim into
`~/.claude/prompthud/base.sh`, then rewrites the statusLine to run that base
first and `session-cmds render` second. We treat the base as a **black box** —
no dependency on paths, runtimes, or internal APIs. Works for any statusline
plugin whose command reads Claude Code's JSON from stdin and prints to stdout.

Trade-off: uses an extra row. Re-running the upstream setup overwrites the wrap;
re-run `/prompthud:wrap-claude-hud` to re-capture.

### Revert

Run `/claude-hud:setup` (or `/prompthud:setup`) — both reset the statusLine
cleanly.

## Requirements

- Python 3 (macOS has it by default; Linux: install `python3` package)

## Layout

```
prompthud/
├── bin/
│   ├── session-cmds              POSIX shell wrapper (detects python3)
│   ├── install-statusline.py     /prompthud:setup worker
│   └── bridge-claude-hud.py      /prompthud:bridge-claude-hud worker
├── lib/
│   └── session_cmds.py           CLI: log/statusline/label/list/show/tail
├── hooks/
│   └── hooks.json                UserPromptSubmit → session-cmds log
├── scripts/
│   └── statusline-wrapper.sh     Claude Code statusline entry (standalone only)
├── commands/
│   ├── list.md                   /prompthud:list
│   ├── setup.md                  /prompthud:setup
│   └── bridge-claude-hud.md      /prompthud:bridge-claude-hud
└── .claude-plugin/
    ├── plugin.json
    └── marketplace.json
```

## Data locations

- Per-session log: `~/.claude/prompthud/<session-id>.tsv`
- Backfill source (pre-install sessions): `~/.claude/history.jsonl`

## CLI subcommands

```
session-cmds log               # hook (reads UserPromptSubmit JSON from stdin)
session-cmds statusline        # full standalone HUD — what the statusline calls
session-cmds label             # JSON {"label": "..."} for claude-hud --extra-cmd
session-cmds list              # compact list, default last 20
session-cmds list --all        # show every prompt
session-cmds show N            # print prompt #N in full
session-cmds tail N            # show last N prompts
```

## License

MIT
