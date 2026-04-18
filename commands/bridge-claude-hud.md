---
description: Add prompthud's inline label (`☰ N ▶ current…`) to an existing claude-hud statusline via its public --extra-cmd API
---

Inject prompthud's label command into claude-hud's statusLine configuration.
This uses ONLY claude-hud's public `--extra-cmd` API — we do not invoke
claude-hud's internals, so plugin upgrades on their side won't break us as
long as they keep honouring `--extra-cmd`.

Requires: claude-hud already installed and its statusLine already configured
(run `/claude-hud:setup` first).

Run this command:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/bin/bridge-claude-hud.py"
```

Tell the user what changed, and to `/reload-plugins` or restart Claude Code.
If they want the bridge removed, they can re-run `/claude-hud:setup` which
rewrites the statusLine without `--extra-cmd`.
