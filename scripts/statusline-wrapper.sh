#!/bin/sh
# prompthud statusline entry point — standalone only.
# We do NOT wrap claude-hud or any other statusline plugin.
# If you want prompthud to appear alongside claude-hud's output, use
# /prompthud:bridge-claude-hud, which configures claude-hud's public
# --extra-cmd API instead of invoking its internals.
#
# Display env vars:
#   PROMPTHUD_LINES    1|2|auto   Force cmds row count (default: auto)
#   PROMPTHUD_COMPACT  1          Drop model/git/ctx header row
#   PROMPTHUD_DEBUG    1          Log diagnostics to $CLAUDE_CONFIG_DIR/prompthud/debug.log
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="$PLUGIN_ROOT/bin/session-cmds"
LINES_ARG="${PROMPTHUD_LINES:-auto}"

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
DEBUG_LOG="$CLAUDE_DIR/prompthud/debug.log"
mkdir -p "$CLAUDE_DIR/prompthud" 2>/dev/null || true
dbg() {
    [ -n "${PROMPTHUD_DEBUG:-}" ] && printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >> "$DEBUG_LOG"
    return 0
}

# Width detection via /dev/tty (std streams are piped by Claude Code).
# All failure paths return 0 so `set -e` doesn't kill the wrapper.
detect_cols() {
    cols=""
    if [ -c /dev/tty ] && [ -r /dev/tty ]; then
        {
            raw=$(stty -f /dev/tty size 2>/dev/null) && cols=$(echo "$raw" | awk '{print $2}') || true
            [ -z "${cols:-}" ] && raw=$(stty -F /dev/tty size 2>/dev/null) && cols=$(echo "$raw" | awk '{print $2}') || true
            [ -z "${cols:-}" ] && raw=$(stty size </dev/tty 2>/dev/null) && cols=$(echo "$raw" | awk '{print $2}') || true
            [ -z "${cols:-}" ] && command -v tput >/dev/null 2>&1 && cols=$(tput cols </dev/tty 2>/dev/null || tput cols 2>/dev/null || true) || true
        } 2>/dev/null
    fi
    case "${cols:-}" in ''|*[!0-9]*) cols="" ;; esac
    [ -n "$cols" ] && [ "$cols" -gt 0 ] && echo "$cols"
    return 0
}

if [ -z "${COLUMNS:-}" ]; then
    DETECTED=$(detect_cols || true)
    [ -n "$DETECTED" ] && export COLUMNS="$DETECTED"
fi

INPUT=$(cat)
dbg "lines=$LINES_ARG cols=${COLUMNS:-?}"

compact=""
if [ -n "${PROMPTHUD_COMPACT:-}" ]; then
    compact="--compact"
fi
printf '%s' "$INPUT" | "$CLI" statusline --lines "$LINES_ARG" $compact 2>/dev/null || true
