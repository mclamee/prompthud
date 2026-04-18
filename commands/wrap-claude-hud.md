---
description: Wrap the current statusLine command (e.g. claude-hud) and append prompthud's prompts row below it
---

Capture whatever statusLine command is currently configured (claude-hud or any
other) as a black box, then rewrite the statusLine so prompthud's prompts row
prints right after it.

Unlike `bridge-claude-hud`, this wrap **does not** depend on claude-hud's
`--extra-cmd` API or its internal paths/runtimes. We just invoke the captured
command and run ours after. Survives any upstream upgrade as long as their
setup writes a working stdin-→-stdout statusLine command.

Requires: you have already run `/claude-hud:setup` (or some other setup that
installed a working statusLine).

Run this command:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/bin/wrap-claude-hud.py"
```

Tell the user what was captured and remind them to `/reload-plugins` or restart
Claude Code. Also note: re-running the upstream setup (e.g. `/claude-hud:setup`)
will overwrite the wrap; they can re-wrap afterwards.
