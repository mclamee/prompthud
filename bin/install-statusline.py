#!/usr/bin/env python3
"""Install prompthud as the Claude Code statusline.

Writes a statusline command to ~/.claude/settings.json that dynamically
discovers the latest installed prompthud version in the plugin cache.
Safe to re-run — replaces only the statusLine field.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

SETTINGS_PATH = Path.home() / ".claude" / "settings.json"

# Preserve any of these env vars the user had set on the previous command.
PRESERVED_ENV = ("PROMPTHUD_LINES", "PROMPTHUD_COMPACT", "PROMPTHUD_DEBUG")


_ENV_RE = re.compile(
    r"\b(?P<key>PROMPTHUD_[A-Z_]+)=(?P<val>[A-Za-z0-9_./-]+)"
)


def extract_env_prefix(prev: str) -> str:
    """Scan the previous command for PROMPTHUD_* env assignments and return them
    as a shell prefix string (first occurrence per key wins, order preserved)."""
    if not prev:
        return ""
    seen: dict[str, str] = {}
    for m in _ENV_RE.finditer(prev):
        key = m.group("key")
        if key in PRESERVED_ENV and key not in seen:
            seen[key] = m.group("val")
    if not seen:
        return ""
    return " ".join(f"{k}={v}" for k, v in seen.items()) + " "


def build_statusline_command(env_prefix: str = "") -> str:
    """Bash one-liner: glob latest prompthud cache dir and run wrapper.

    env_prefix goes before the final `bash` invocation so the child process
    actually inherits the vars (shell prefix-assignment only scopes to that cmd).
    """
    return (
        "bash -c '"
        "cdir=\"${CLAUDE_CONFIG_DIR:-$HOME/.claude}\";"
        " plug=$(ls -td \"$cdir\"/plugins/cache/*/prompthud/*/ 2>/dev/null | head -1);"
        " if [ -n \"$plug\" ]; then "
        f"{env_prefix}bash \"${{plug}}scripts/statusline-wrapper.sh\";"
        " elif [ -n \"$PROMPTHUD_DEBUG\" ]; then "
        "mkdir -p \"$cdir/prompthud\" 2>/dev/null;"
        " echo \"prompthud: plugin cache glob missed under $cdir/plugins/cache/*/prompthud/\" "
        ">> \"$cdir/prompthud/debug.log\" 2>/dev/null;"
        " fi'"
    )


def main() -> int:
    if not SETTINGS_PATH.exists():
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        settings = {}
    else:
        try:
            settings = json.loads(SETTINGS_PATH.read_text())
        except json.JSONDecodeError as e:
            print(f"error: failed to parse {SETTINGS_PATH}: {e}", file=sys.stderr)
            return 1

    previous = settings.get("statusLine", {}).get("command", "")
    env_prefix = extract_env_prefix(previous)
    settings["statusLine"] = {
        "type": "command",
        "command": build_statusline_command(env_prefix),
    }

    SETTINGS_PATH.write_text(json.dumps(settings, indent=2, ensure_ascii=False))
    print(f"✓ statusLine updated in {SETTINGS_PATH}")
    if previous:
        print(f"  previous: {previous[:80]}{'…' if len(previous) > 80 else ''}")
    print()
    print("Optional env-prefix on the statusLine command:")
    print("  PROMPTHUD_LINES=1|2|auto   row count (auto = smart split on long prompts)")
    print("  PROMPTHUD_COMPACT=1        drop the model/git/ctx header row")
    print()
    print("To also show prompts on top of claude-hud, run /prompthud:bridge-claude-hud")
    print("(after /claude-hud:setup).")
    print()
    print("Restart Claude Code or run /reload-plugins to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
