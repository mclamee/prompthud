---
description: Wire up the prompthud statusline in ~/.claude/settings.json
---

Install the prompthud statusline into `~/.claude/settings.json`. Preserves any
`PROMPTHUD_*` env-prefix the user had set on a previous install.

Run this bash command:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/bin/install-statusline.py"
```

After it finishes, tell the user what was configured, then mention:

- `PROMPTHUD_LINES=1|2|auto` for row count,
- `PROMPTHUD_COMPACT=1` to hide the header row,
- and `/prompthud:bridge-claude-hud` if they also use claude-hud and want both.

Remind them to restart Claude Code or run `/reload-plugins`.

Note: /prompthud:setup OVERWRITES the statusLine. If they previously ran
`/claude-hud:setup`, this replaces claude-hud's statusline with prompthud's.
To run both, use `/claude-hud:setup` followed by `/prompthud:bridge-claude-hud`.
