---
description: List all prompts you've sent in the current session
---

Run the plugin CLI and print its output verbatim as a fenced code block.

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/session-cmds" list
```

Rules:
- Run ONLY that single command; do not pipe, wrap, or post-process it.
- Copy the output into a ` ``` ` code block exactly as printed.
- Do NOT re-format, re-sort, or expand truncated rows.
- If the user asks for details on a specific item (e.g. "看 #3", "show 3"), run:
  `"${CLAUDE_PLUGIN_ROOT}/bin/session-cmds" show 3`
- If they ask for the last N (e.g. "最近 5 条"), run:
  `"${CLAUDE_PLUGIN_ROOT}/bin/session-cmds" tail 5`
- If they want the full list, run with `list --all`.

Output is compact (default last 20 rows, ~60 chars each) to keep context small.
