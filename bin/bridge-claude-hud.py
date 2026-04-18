#!/usr/bin/env python3
"""Bridge prompthud into claude-hud via its public `--extra-cmd` API.

claude-hud exposes `--extra-cmd <command>` on its entry point; the command
must print a single JSON line `{"label": "..."}`. prompthud ships a matching
`session-cmds label` subcommand.

This script:
  1. Reads ~/.claude/settings.json
  2. Finds the statusLine command (expected to be claude-hud's)
  3. Inserts `--extra-cmd "<prompthud>/bin/session-cmds label"` into it
  4. Writes back

We only depend on claude-hud's public --extra-cmd API, nothing else about
its internals (paths, build format, runtime choice). If claude-hud renames
files or changes runtimes, this still works as long as they keep --extra-cmd.

Re-running this script is idempotent: it replaces the existing --extra-cmd
arg rather than appending duplicates.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

SETTINGS_PATH = Path(os.environ.get("CLAUDE_CONFIG_DIR") or (Path.home() / ".claude")) / "settings.json"


def _prompthud_label_cmd() -> str:
    """Best-effort path to the installed prompthud label command."""
    # When running as `/prompthud:bridge-claude-hud`, Claude Code sets
    # CLAUDE_PLUGIN_ROOT for us.  Otherwise we walk up from this file.
    root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if not root:
        root = str(Path(__file__).resolve().parent.parent)
    return f"{root}/bin/session-cmds label"


def _shell_dquote(value: str) -> str:
    """Double-quote a value for use INSIDE a `bash -c '...'` single-quoted arg.

    Single-quoting would conflict with the outer single quotes. Double quotes
    nest fine, and we only need to escape `"`, `\\`, `$`, and backtick inside.
    """
    escaped = (
        value.replace("\\", "\\\\")
             .replace('"', '\\"')
             .replace("$", "\\$")
             .replace("`", "\\`")
    )
    return f'"{escaped}"'


def _inject_extra_cmd(command: str, extra: str) -> str:
    """Insert `--extra-cmd "<extra>"` into claude-hud's bash-wrapped command.

    If an --extra-cmd is already present, replace its value.
    Otherwise, insert just before the closing single-quote of the bash -c arg.
    """
    quoted = _shell_dquote(extra)

    # Replace existing --extra-cmd argument (either --extra-cmd=X or --extra-cmd X)
    replaced = re.sub(
        r"--extra-cmd(?:=|\s+)(?:\"[^\"]*\"|'[^']*'|\S+)",
        f"--extra-cmd {quoted}",
        command,
        count=1,
    )
    if replaced != command:
        return replaced

    # No existing --extra-cmd: inject before closing `'` of the outer bash -c arg.
    m = re.search(r"(.*)(')\s*$", command)
    if not m:
        return command
    prefix, close_quote = m.group(1), m.group(2)
    return f"{prefix} --extra-cmd {quoted}{close_quote}"


def main() -> int:
    if not SETTINGS_PATH.exists():
        print(f"error: {SETTINGS_PATH} does not exist.", file=sys.stderr)
        print("Run /claude-hud:setup first to install claude-hud's statusline.", file=sys.stderr)
        return 1

    try:
        settings = json.loads(SETTINGS_PATH.read_text())
    except json.JSONDecodeError as e:
        print(f"error: failed to parse {SETTINGS_PATH}: {e}", file=sys.stderr)
        return 1

    sl = settings.get("statusLine")
    if not sl or not sl.get("command"):
        print("error: no statusLine.command configured.", file=sys.stderr)
        print("Run /claude-hud:setup first, then re-run this bridge.", file=sys.stderr)
        return 1

    current = sl["command"]
    if "claude-hud" not in current:
        print("warning: current statusLine doesn't look like claude-hud's command.", file=sys.stderr)
        print(f"  current: {current[:120]}{'…' if len(current) > 120 else ''}", file=sys.stderr)
        print("Injecting --extra-cmd anyway; revert manually if this is wrong.", file=sys.stderr)

    label_cmd = _prompthud_label_cmd()
    new_cmd = _inject_extra_cmd(current, label_cmd)

    if new_cmd == current:
        print("error: could not safely inject --extra-cmd into the current command.", file=sys.stderr)
        print(f"  command: {current}", file=sys.stderr)
        return 1

    sl["command"] = new_cmd
    SETTINGS_PATH.write_text(json.dumps(settings, indent=2, ensure_ascii=False))

    print(f"✓ Bridged prompthud into claude-hud via --extra-cmd")
    print(f"  label command: {label_cmd}")
    print()
    print("claude-hud will now call prompthud to render an inline label")
    print("  `☰ N ▶ current question…` on its session line.")
    print()
    print("To remove the bridge: re-run /claude-hud:setup to reset.")
    print("Restart Claude Code or /reload-plugins to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
