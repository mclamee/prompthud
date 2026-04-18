---
description: Bridge the current statusLine (e.g. claude-hud) with promptHUD's prompts row below it
---

Capture whatever statusLine command is currently configured (claude-hud or any
other) as a black box, then rewrite the statusLine so promptHUD's prompts row
prints right after it.

The bridge **does not** depend on the underlying plugin's internal paths,
runtimes, or APIs. We just invoke the captured command and run ours after.
Survives any upstream upgrade as long as their setup writes a working
stdin-→-stdout statusLine command.

Requires: you have already run `/claude-hud:setup` (or some other setup that
installed a working statusLine).

Run this command:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/bin/bridge-claude-hud.py"
```

Tell the user what was captured and remind them to `/reload-plugins` or restart
Claude Code. Also note: re-running the upstream setup (e.g. `/claude-hud:setup`)
will overwrite the bridge; they can re-bridge afterwards.
