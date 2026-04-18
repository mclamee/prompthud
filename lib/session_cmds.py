#!/usr/bin/env python3
"""prompthud internal CLI — renders the session-prompts HUD.

Subcommands (all called by the plugin itself, not by end users):
  log         UserPromptSubmit hook — reads JSON from stdin, appends to TSV log.
  statusline  Full standalone HUD (model · git · ctx header + prompts row).
  render      Prompts row only, for wrapping on top of another statusline.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from typing import Dict, List, Optional, Tuple

try:
    import fcntl  # POSIX-only; Windows falls back to no-op locking.
    _HAS_FCNTL = True
except ImportError:
    fcntl = None  # type: ignore
    _HAS_FCNTL = False

# ──────────────────────────────────────────────────────────────────────────────
# Paths — honour CLAUDE_CONFIG_DIR to match Claude Code / claude-hud conventions.
# ──────────────────────────────────────────────────────────────────────────────
HOME = os.path.expanduser("~")
CLAUDE_DIR = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(HOME, ".claude")
LOG_DIR = os.path.join(CLAUDE_DIR, "prompthud")
# Legacy path from when the plugin was called claude-session-explorer.
LEGACY_LOG_DIR = os.path.join(CLAUDE_DIR, "session-explorer")
HISTORY_FILE = os.path.join(CLAUDE_DIR, "history.jsonl")

# ──────────────────────────────────────────────────────────────────────────────
# ANSI (used only by `render`)
# ──────────────────────────────────────────────────────────────────────────────
RESET = "\033[0m"
DIM = "\033[2m"
BOLD = "\033[1m"
CYAN = "\033[36m"
GREEN = "\033[32m"
MAGENTA = "\033[35m"
YELLOW = "\033[33m"
RED = "\033[31m"

# ──────────────────────────────────────────────────────────────────────────────
# Data access
# ──────────────────────────────────────────────────────────────────────────────
Command = Tuple[int, str]  # (unix_seconds, text)


def _session_log_path(session_id: str) -> str:
    return os.path.join(LOG_DIR, f"{session_id}.tsv")


def _extract_session_id(transcript_path: str) -> str:
    base = os.path.basename(transcript_path or "")
    return base[:-6] if base.endswith(".jsonl") else base


def _read_log(session_id: str) -> Optional[List[Command]]:
    """Read TSV log for a session. Returns None when no log file exists at all
    (caller may try to backfill). Returns [] for an existing-but-empty log —
    the distinction matters: we must not overwrite an unreadable log with
    history-derived data (data-loss risk)."""
    for base_dir in (LOG_DIR, LEGACY_LOG_DIR):
        path = os.path.join(base_dir, f"{session_id}.tsv")
        if os.path.exists(path):
            cmds: List[Command] = []
            with open(path) as f:
                for line in f:
                    line = line.rstrip("\n")
                    if not line:
                        continue
                    parts = line.split("\t", 1)
                    if len(parts) != 2:
                        continue
                    try:
                        cmds.append((int(parts[0]), parts[1]))
                    except ValueError:
                        continue
            return cmds
    return None


def _write_log(session_id: str, cmds: List[Command]) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(_session_log_path(session_id), "w") as f:
        for ts, text in cmds:
            f.write(f"{ts}\t{text}\n")


def _backfill_from_history(session_id: str) -> List[Command]:
    if not os.path.exists(HISTORY_FILE):
        return []
    cmds: List[Command] = []
    try:
        with open(HISTORY_FILE) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("sessionId") != session_id:
                    continue
                display = (entry.get("display") or "").strip()
                if not display:
                    continue
                ts = entry.get("timestamp", 0) // 1000
                cmds.append((ts, display))
    except OSError:
        return []
    if cmds:
        _write_log(session_id, cmds)
    return cmds


def _load_commands(session_id: str) -> List[Command]:
    cmds = _read_log(session_id)
    # Only backfill when no log file exists at all. If the file exists but is
    # empty (or unreadable raises), don't clobber it with history data.
    if cmds is None:
        return _backfill_from_history(session_id)
    return cmds


# ──────────────────────────────────────────────────────────────────────────────
# Transcript state detection
#
# Our TSV log captures every prompt the user submits (via UserPromptSubmit
# hook), but it has no concept of whether that prompt was interrupted or is
# still being answered. Claude Code's transcript JSONL is the canonical source
# of turn state. Each user turn is followed by one or more assistant messages;
# an interrupt is recorded as a synthetic user message with content
# "[Request interrupted by user]". A still-pending turn has no assistant
# stop_reason=end_turn after it yet.
# ──────────────────────────────────────────────────────────────────────────────
STATE_COMPLETED = "completed"
STATE_INTERRUPTED = "interrupted"
STATE_PENDING = "pending"

_INTERRUPT_MARK = "[Request interrupted by user]"

# String-content user messages that start with these wrappers are synthetic —
# emitted by Claude Code itself (slash-command plumbing, local-command output,
# caveats) and do NOT correspond to real user prompts the hook ever sees.
_SYNTHETIC_STRING_PREFIXES = (
    "<local-command-",
    "<command-name>",
    "<command-message>",
    "<command-args>",
    "<command-stdout>",
    "<command-stderr>",
)


def _is_synthetic_string_content(text: str) -> bool:
    s = text.lstrip()
    return any(s.startswith(p) for p in _SYNTHETIC_STRING_PREFIXES)


def _read_transcript_states(transcript_path: str) -> List[str]:
    """Walk the transcript and return one state per *real* user prompt, in
    order. "Real" excludes tool-result user messages, sidechain user messages,
    and the synthetic interrupt-marker user messages themselves."""
    if not transcript_path or not os.path.exists(transcript_path):
        return []
    states: List[str] = []
    try:
        with open(transcript_path) as f:
            for line in f:
                try:
                    entry = json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue
                etype = entry.get("type")
                if etype == "user":
                    if entry.get("isSidechain"):
                        continue
                    msg = entry.get("message") or {}
                    content = msg.get("content")
                    # Old string-content form
                    if isinstance(content, str):
                        if (content.strip()
                                and _INTERRUPT_MARK not in content
                                and not _is_synthetic_string_content(content)):
                            states.append(STATE_PENDING)
                        continue
                    if not isinstance(content, list):
                        continue
                    has_interrupt = False
                    has_tool_result = False
                    has_real_text = False
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        btype = block.get("type")
                        if btype == "tool_result":
                            has_tool_result = True
                        elif btype == "text":
                            text = block.get("text") or ""
                            if _INTERRUPT_MARK in text:
                                has_interrupt = True
                            elif text.strip():
                                has_real_text = True
                    if has_interrupt and states:
                        # The preceding still-pending prompt is the one that
                        # got interrupted.
                        for i in range(len(states) - 1, -1, -1):
                            if states[i] == STATE_PENDING:
                                states[i] = STATE_INTERRUPTED
                                break
                        continue
                    if has_tool_result and not has_real_text:
                        continue
                    if has_real_text:
                        states.append(STATE_PENDING)
                elif etype == "assistant":
                    msg = entry.get("message") or {}
                    stop = msg.get("stop_reason")
                    # Any terminal stop reason closes the turn. `tool_use` is
                    # mid-turn — keep state as pending until the subsequent
                    # terminal message lands.
                    if stop in ("end_turn", "stop_sequence", "max_tokens") \
                            and states and states[-1] == STATE_PENDING:
                        states[-1] = STATE_COMPLETED
    except OSError:
        return []
    return states


def _align_states_to_cmds(cmds: List[Command], states: List[str]) -> Dict[int, str]:
    """Return a 1-based-index → state mapping. Align by trailing position so
    the most-recent prompts always carry the correct state even if our TSV
    count and the transcript's user-prompt count diverge (e.g. after a
    backfill)."""
    out: Dict[int, str] = {}
    n, m = len(cmds), len(states)
    k = min(n, m)
    for i in range(k):
        cmd_idx_1based = n - i  # 1-based
        state = states[m - 1 - i]
        if state != STATE_COMPLETED:
            out[cmd_idx_1based] = state
    return out


# When `cmd_render` consumes stdin to resolve the session, we want to keep the
# parsed JSON around so the caller can also pull transcript_path out of it.
# This module-level cache is fine because each CLI invocation is a one-shot
# subprocess — there's no long-lived state to worry about.
_STDIN_JSON_CACHE: Optional[dict] = None


def _resolve_session_id(explicit: Optional[str], use_stdin: bool = False) -> Optional[str]:
    """Resolve session ID from explicit arg, stdin JSON (opt-in), or recent history.

    `use_stdin` is only True for subcommands that are piped JSON (log, render).
    Other subcommands skip stdin because parent callers (e.g. bun's exec) may
    leave stdin open and block forever on read.
    """
    global _STDIN_JSON_CACHE
    if explicit:
        return explicit

    if use_stdin and not sys.stdin.isatty():
        raw = sys.stdin.read()
        if raw.strip():
            try:
                data = json.loads(raw)
                _STDIN_JSON_CACHE = data
                sid = data.get("session_id") or _extract_session_id(data.get("transcript_path", ""))
                if sid:
                    return sid
            except json.JSONDecodeError:
                pass

    # Fallback: most recent session in history.jsonl for current project
    if not os.path.exists(HISTORY_FILE):
        return None
    project = os.getcwd()
    latest: Optional[str] = None
    try:
        with open(HISTORY_FILE) as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("project") == project and obj.get("sessionId"):
                    latest = obj["sessionId"]
    except OSError:
        return None
    return latest


_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[mK]")


def _visual_width(text: str) -> int:
    """Terminal cell width — strips ANSI, counts CJK/emoji as 2."""
    plain = _ANSI_RE.sub("", text)
    w = 0
    for ch in plain:
        if unicodedata.east_asian_width(ch) in ("W", "F"):
            w += 2
        elif unicodedata.category(ch).startswith("C"):
            continue  # control/non-printing
        else:
            w += 1
    return w


def _truncate_to_width(text: str, max_cells: int) -> str:
    """Truncate by terminal cell width (handles CJK)."""
    if max_cells <= 0:
        return ""
    if _visual_width(text) <= max_cells:
        return text
    out = ""
    w = 0
    for ch in text:
        cw = 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
        if w + cw > max_cells - 1:
            break
        out += ch
        w += cw
    return out + "\u2026"


DEBUG_LOG = os.path.join(LOG_DIR, "debug.log")


def _debug_log(msg: str) -> None:
    if os.environ.get("PROMPTHUD_DEBUG"):
        try:
            os.makedirs(LOG_DIR, exist_ok=True)
            with open(DEBUG_LOG, "a") as f:
                f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
        except OSError:
            pass


SAFETY_MARGIN = 6  # Claude Code's statusline area appears narrower than tty

# ANSI "clear to end of line" — ensures each redraw overwrites every column
# up to the cursor so stale glyphs from the previous render (e.g. a digit
# from a shorter count) don't leak into the new render. Without this the
# HUD would briefly show "689" between "68" and "69" while the host UI
# reflowed a width-changing line.
CLEAR_EOL = "\033[K"


def _print_hud_line(line: str, total_width: int) -> None:
    """Right-pad to the visible width so every column gets overwritten, then
    clear-to-end-of-line as belt and braces. Safe against ANSI escapes since
    padding is computed from visible cell width."""
    pad = max(0, total_width - _visual_width(line))
    sys.stdout.write(f"{RESET}{line}{' ' * pad}{CLEAR_EOL}\n")


# Collapsed run: (last_ts, text, last_1based_num, run_count)
Run = Tuple[int, str, int, int]


def _collapse_runs(cmds: List[Command]) -> List[Run]:
    """Group consecutive identical prompts into runs for compact display.

    Each run carries the run's LAST timestamp and LAST 1-based index plus the
    count. Downstream packing uses the last index so `show N` still addresses
    the most recent occurrence of a repeated prompt.
    """
    runs: List[Run] = []
    if not cmds:
        return runs
    cur_ts, cur_text = cmds[0]
    cur_last_idx = 0
    cur_count = 1
    for i in range(1, len(cmds)):
        ts, text = cmds[i]
        if text == cur_text:
            cur_ts = ts
            cur_last_idx = i
            cur_count += 1
        else:
            runs.append((cur_ts, cur_text, cur_last_idx + 1, cur_count))
            cur_ts, cur_text = ts, text
            cur_last_idx = i
            cur_count = 1
    runs.append((cur_ts, cur_text, cur_last_idx + 1, cur_count))
    return runs


def _detect_terminal_width() -> int:
    """Best-effort terminal width detection in a statusline subprocess.

    Order (first non-zero wins):
      1. $COLUMNS env var (cheapest; user/wrapper can set it explicitly)
      2. ioctl TIOCGWINSZ on fd 0/1/2 (works if any std stream is a tty)
      3. Open /dev/tty and ioctl (works when std streams are piped)
      4. `tput cols` subprocess (reads from controlling tty)
      5. Fallback to 120 (better than 80 for modern terminals)
    """
    env_cols = os.environ.get("COLUMNS")
    if env_cols and env_cols.isdigit():
        w = int(env_cols)
        if w > 0:
            _debug_log(f"width=COLUMNS:{w}")
            return w

    for fd_num in (2, 1, 0):
        try:
            size = os.get_terminal_size(fd_num)
            if size.columns > 0:
                _debug_log(f"width=fd{fd_num}:{size.columns}")
                return size.columns
        except (OSError, ValueError):
            continue

    try:
        fd = os.open("/dev/tty", os.O_RDONLY)
        try:
            size = os.get_terminal_size(fd)
            if size.columns > 0:
                _debug_log(f"width=/dev/tty:{size.columns}")
                return size.columns
        finally:
            os.close(fd)
    except OSError:
        pass

    try:
        result = subprocess.run(
            ["tput", "cols"], capture_output=True, text=True, timeout=1,
        )
        if result.returncode == 0 and result.stdout.strip().isdigit():
            w = int(result.stdout.strip())
            if w > 0:
                _debug_log(f"width=tput:{w}")
                return w
    except (subprocess.SubprocessError, OSError):
        pass

    _debug_log("width=fallback:120")
    return 120


# ──────────────────────────────────────────────────────────────────────────────
# Subcommand: log (hook)
# ──────────────────────────────────────────────────────────────────────────────
# Claude Code sometimes re-invokes UserPromptSubmit on retries/regenerations,
# which would inflate our log with duplicates of the same user message. Skip
# writing when the most-recent logged entry matches within this window.
_DEDUP_WINDOW_SECONDS = 30


def cmd_log(_args: argparse.Namespace) -> int:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # fail-silent for hooks
    session_id = data.get("session_id") or ""
    # Strip tabs too — they'd corrupt our TSV layout since rows are `ts\tprompt`.
    prompt = (data.get("prompt") or "").replace("\n", " ").replace("\t", " ").strip()
    if not session_id or not prompt:
        return 0

    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = _session_log_path(session_id)
    now = int(time.time())

    # Hold an exclusive file lock across read-tail + append so two concurrent
    # UserPromptSubmit hook invocations can't both pass dedup and double-write.
    # Windows lacks fcntl; race window is very narrow there, dedup still catches
    # the common case since we read-then-append within a single syscall pair.
    with open(log_path, "a+b") as f:
        if _HAS_FCNTL:
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            except OSError:
                pass  # best-effort — proceed without a lock on exotic filesystems
        f.seek(0, os.SEEK_END)
        size = f.tell()
        if size > 0:
            read_size = min(size, 8192)
            f.seek(-read_size, os.SEEK_END)
            tail = f.read().decode("utf-8", errors="replace")
            last_line = tail.rstrip("\n").rsplit("\n", 1)[-1]
            if last_line:
                parts = last_line.split("\t", 1)
                if len(parts) == 2:
                    try:
                        last_ts = int(parts[0])
                    except ValueError:
                        last_ts = 0
                    last_prompt = parts[1]
                    if last_prompt == prompt and (now - last_ts) <= _DEDUP_WINDOW_SECONDS:
                        return 0  # dup within window, skip
        f.write(f"{now}\t{prompt}\n".encode("utf-8"))
    return 0


# ──────────────────────────────────────────────────────────────────────────────
# Subcommand: statusline (fully self-contained HUD, no claude-hud dependency)
# ──────────────────────────────────────────────────────────────────────────────
def _git_branch(cwd: str) -> Optional[str]:
    if not cwd:
        return None
    try:
        res = subprocess.run(
            ["git", "-C", cwd, "symbolic-ref", "--short", "HEAD"],
            capture_output=True, text=True, timeout=1,
        )
        if res.returncode == 0:
            branch = res.stdout.strip()
            # detect dirty
            dirty_res = subprocess.run(
                ["git", "-C", cwd, "status", "--porcelain"],
                capture_output=True, text=True, timeout=1,
            )
            if dirty_res.returncode == 0 and dirty_res.stdout.strip():
                branch += "*"
            return branch
    except (subprocess.SubprocessError, OSError):
        pass
    return None


def _context_bar(pct: float, width: int = 10) -> str:
    pct = max(0.0, min(100.0, pct))
    filled = int(round(pct / 100 * width))
    color = GREEN if pct < 70 else (YELLOW if pct < 85 else RED)
    return f"{color}{'█' * filled}{DIM}{'░' * (width - filled)}{RESET}"


def _run_suffix(count: int) -> str:
    """Plain-text `×N` suffix (empty when run of 1)."""
    return f" \u00d7{count}" if count > 1 else ""


INTERRUPTED_GLYPH = "\u2717"  # ✗
PENDING_GLYPH = "\u22ef"      # ⋯


def _run_is_interrupted(run_last_idx_1based: int, run_count: int, states: Dict[int, str]) -> bool:
    """A collapsed run covers 1-based indices
       [run_last_idx_1based - run_count + 1, ..., run_last_idx_1based].
    Treat the run as interrupted if ANY of those indices is interrupted."""
    for i in range(run_last_idx_1based - run_count + 1, run_last_idx_1based + 1):
        if states.get(i) == STATE_INTERRUPTED:
            return True
    return False


def _run_is_pending(run_last_idx_1based: int, states: Dict[int, str]) -> bool:
    """Only the last index of a run can be pending (any later prompt would
    have closed the run). So we only check the terminal index."""
    return states.get(run_last_idx_1based) == STATE_PENDING


def _pack_cmds_two_line(
    cmds: List[Command],
    max_width: int,
    max_cmd_width: int = 30,
    states: Optional[Dict[int, str]] = None,
) -> List[str]:
    """Two-line layout: past runs on row 1, current run on row 2."""
    if not cmds:
        return []
    states = states or {}
    runs = _collapse_runs(cmds)
    total = len(cmds)

    # --- Line 2: current run ---
    _, cur_text, cur_num, cur_count = runs[-1]
    cur_clean = cur_text.replace("\n", " ")
    suf = _run_suffix(cur_count)
    prefix_cur = f"\u25b6 {cur_num}."
    cur_pending = _run_is_pending(cur_num, states)
    pending_tail_plain = f" {PENDING_GLYPH}" if cur_pending else ""
    prefix_cur_w = _visual_width(prefix_cur) + _visual_width(suf) + _visual_width(pending_tail_plain)
    budget_cur = max(20, max_width - prefix_cur_w)
    cur_short = _truncate_to_width(cur_clean, budget_cur)
    pending_tail_styled = f"{DIM}{pending_tail_plain}{RESET}" if cur_pending else ""
    line2 = f"{GREEN}{BOLD}{prefix_cur}{cur_short}{suf}{RESET}{pending_tail_styled}"

    # --- Line 1: header + past runs (greedy, right-to-left) ---
    header_plain = f"\u2630 {total}"
    sep_plain = " | "
    header_width = _visual_width(header_plain)
    sep_width = _visual_width(sep_plain)

    past_runs = runs[:-1]
    if not past_runs:
        line1 = f"{MAGENTA}{header_plain}{RESET}"
        return [line1, line2]

    remaining = max_width - header_width
    fitted: List[str] = []
    fitted_runs = 0
    for i in range(len(past_runs) - 1, -1, -1):
        _, text, num, count_ = past_runs[i]
        text_clean = text.replace("\n", " ")
        suf_i = _run_suffix(count_)
        is_interrupted = _run_is_interrupted(num, count_, states)
        int_lead_plain = f"{INTERRUPTED_GLYPH}" if is_interrupted else ""
        prefix_p = f"{num}."
        prefix_p_w = _visual_width(int_lead_plain) + _visual_width(prefix_p) + _visual_width(suf_i)
        hidden_runs_if_stop = i
        hidden_tail_w = _visual_width(f" (+{hidden_runs_if_stop} more)") if hidden_runs_if_stop > 0 else 0
        needed = sep_width + prefix_p_w + 8 + hidden_tail_w
        if remaining < needed:
            break
        budget = min(max_cmd_width, remaining - sep_width - prefix_p_w - hidden_tail_w)
        if budget < 8:
            break
        short = _truncate_to_width(text_clean, budget)
        if is_interrupted:
            piece = f"{RED}{int_lead_plain}{RESET}{DIM}{prefix_p}{short}{suf_i}{RESET}"
        else:
            piece = f"{DIM}{prefix_p}{RESET}{CYAN}{short}{RESET}{DIM}{suf_i}{RESET}"
        consumed = sep_width + _visual_width(int_lead_plain + prefix_p + short) + _visual_width(suf_i)
        remaining -= consumed
        fitted.append(piece)
        fitted_runs += 1

    hidden_runs = len(past_runs) - fitted_runs
    hidden_label = f" {DIM}(+{hidden_runs} more){RESET}" if hidden_runs > 0 else ""
    header_styled = f"{MAGENTA}{header_plain}{RESET}{hidden_label}"
    sep_styled = f" {DIM}|{RESET} "
    if fitted:
        line1 = header_styled + sep_styled + sep_styled.join(reversed(fitted))
    else:
        line1 = header_styled
    return [line1, line2]


def _pack_cmds_into_width(
    cmds: List[Command],
    max_width: int,
    min_cmd_width: int = 8,
    max_cmd_width: int = 40,
    states: Optional[Dict[int, str]] = None,
) -> str:
    """Greedily pack session commands into a single line ≤ max_width cells.

    Consecutive identical prompts collapse into a `×N` run. Always includes the
    current run; adds earlier runs (reverse chronological) while room remains.
    """
    if not cmds:
        return ""
    states = states or {}
    runs = _collapse_runs(cmds)
    total = len(cmds)

    header_plain = f"\u2630 {total}"
    sep_plain = " | "
    header_width = _visual_width(header_plain)
    sep_width = _visual_width(sep_plain)

    remaining = max_width - header_width - sep_width

    # Current run (last)
    _, cur_text, cur_num, cur_count = runs[-1]
    cur_suf = _run_suffix(cur_count)
    cur_pending = _run_is_pending(cur_num, states)
    pending_tail_plain = f" {PENDING_GLYPH}" if cur_pending else ""
    prefix_N = f"\u25b6 {cur_num}."
    prefix_N_w = _visual_width(prefix_N) + _visual_width(cur_suf) + _visual_width(pending_tail_plain)
    cur_clean = cur_text.replace("\n", " ")
    cur_budget = min(max_cmd_width, max(min_cmd_width, remaining - prefix_N_w))
    cur_short = _truncate_to_width(cur_clean, cur_budget)
    cur_piece_w = _visual_width(prefix_N) + _visual_width(cur_short) + _visual_width(cur_suf) + _visual_width(pending_tail_plain)
    pending_tail_styled = f"{DIM}{pending_tail_plain}{RESET}" if cur_pending else ""
    cur_piece_styled = f"{GREEN}{BOLD}{prefix_N}{cur_short}{cur_suf}{RESET}{pending_tail_styled}"

    remaining -= cur_piece_w
    fitted_pieces = [cur_piece_styled]
    fitted_runs = 1

    past_runs = runs[:-1]
    for i in range(len(past_runs) - 1, -1, -1):
        _, text, num, run_count = past_runs[i]
        text_clean = text.replace("\n", " ")
        suf_i = _run_suffix(run_count)
        is_interrupted = _run_is_interrupted(num, run_count, states)
        int_lead_plain = f"{INTERRUPTED_GLYPH}" if is_interrupted else ""
        prefix_p = f"{num}."
        prefix_p_w = _visual_width(int_lead_plain) + _visual_width(prefix_p) + _visual_width(suf_i)
        hidden_runs_if_stop = i
        tail_if_stop = _visual_width(f" (+{hidden_runs_if_stop} more)") if hidden_runs_if_stop > 0 else 0
        needed_min = sep_width + prefix_p_w + min_cmd_width
        if remaining - needed_min < tail_if_stop:
            break
        budget = min(max_cmd_width, remaining - sep_width - prefix_p_w - tail_if_stop)
        if budget < min_cmd_width:
            break
        short = _truncate_to_width(text_clean, budget)
        consumed = sep_width + _visual_width(int_lead_plain + prefix_p + short) + _visual_width(suf_i)
        remaining -= consumed
        if is_interrupted:
            fitted_pieces.append(f"{RED}{int_lead_plain}{RESET}{DIM}{prefix_p}{short}{suf_i}{RESET}")
        else:
            fitted_pieces.append(f"{DIM}{prefix_p}{RESET}{CYAN}{short}{RESET}{DIM}{suf_i}{RESET}")
        fitted_runs += 1

    hidden_runs = len(runs) - fitted_runs
    hidden_label = f"{DIM}(+{hidden_runs} more){RESET}" if hidden_runs > 0 else ""

    header_styled = f"{MAGENTA}{header_plain}{RESET}"
    if hidden_label:
        header_styled += f" {hidden_label}"
    sep_styled = f" {DIM}|{RESET} "
    return header_styled + sep_styled + sep_styled.join(reversed(fitted_pieces))


def cmd_render(args: argparse.Namespace) -> int:
    """Emit only the prompts row — for wrapping other statuslines.

    Reads Claude Code stdin JSON for session_id/transcript_path; width comes
    from $COLUMNS (or tty detection) minus a safety margin.
    """
    sid = _resolve_session_id(args.session_id, use_stdin=True)
    if not sid:
        return 0
    cmds = _load_commands(sid)
    if not cmds:
        return 0
    # _STDIN_JSON_CACHE was populated by _resolve_session_id if stdin had JSON
    transcript_path = (_STDIN_JSON_CACHE or {}).get("transcript_path", "")
    states = _align_states_to_cmds(cmds, _read_transcript_states(transcript_path)) if transcript_path else {}
    width = args.width if args.width > 0 else max(40, _detect_terminal_width() - SAFETY_MARGIN)
    lines_env = os.environ.get("PROMPTHUD_LINES", args.lines)
    if _should_two_line(lines_env, cmds, width, args.max_cmd_width):
        for line in _pack_cmds_two_line(cmds, max_width=width, max_cmd_width=args.max_cmd_width, states=states):
            _print_hud_line(line, width)
    else:
        _print_hud_line(
            _pack_cmds_into_width(cmds, max_width=width, max_cmd_width=args.max_cmd_width, states=states),
            width,
        )
    return 0


def cmd_statusline(args: argparse.Namespace) -> int:
    """Render a self-contained statusline.

    Default: 1 header row (model·project·ctx) + session-cmds row(s).
    --compact: skip the header row to save vertical space.
    """
    raw = "" if sys.stdin.isatty() else sys.stdin.read()
    data = {}
    if raw.strip():
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}

    model_raw = (data.get("model") or {}).get("display_name") or "Claude"
    model = model_raw.split(" (", 1)[0].strip() or model_raw
    cwd = data.get("cwd") or os.getcwd()
    project = os.path.basename(cwd.rstrip("/")) or cwd
    ctx = data.get("context_window") or {}
    ctx_pct = ctx.get("used_percentage")

    transcript_path = data.get("transcript_path", "")
    sid = _extract_session_id(transcript_path) or _resolve_session_id(None, use_stdin=False)
    cmds = _load_commands(sid) if sid else []
    states = _align_states_to_cmds(cmds, _read_transcript_states(transcript_path)) if transcript_path else {}

    width = args.width if args.width > 0 else max(40, _detect_terminal_width() - SAFETY_MARGIN)

    if not args.compact:
        parts = [f"{CYAN}[{model}]{RESET}"]
        branch = _git_branch(cwd)
        if branch:
            parts.append(f"{YELLOW}{project}{RESET} {MAGENTA}git:({CYAN}{branch}{MAGENTA}){RESET}")
        else:
            parts.append(f"{YELLOW}{project}{RESET}")
        if isinstance(ctx_pct, (int, float)):
            parts.append(f"{DIM}ctx{RESET} {_context_bar(float(ctx_pct))} {GREEN}{int(ctx_pct)}%{RESET}")
        _print_hud_line(" │ ".join(parts), width)

    if cmds:
        if _should_two_line(args.lines, cmds, width, args.max_cmd_width):
            for line in _pack_cmds_two_line(cmds, max_width=width, max_cmd_width=args.max_cmd_width, states=states):
                _print_hud_line(line, width)
        else:
            line = _pack_cmds_into_width(cmds, max_width=width, max_cmd_width=args.max_cmd_width, states=states)
            _print_hud_line(line, width)
    return 0


def _should_two_line(mode: str, cmds: List[Command], width: int,
                     max_cmd_width: int = 30) -> bool:
    if mode == "2":
        return True
    if mode == "1":
        return False
    # auto: single-line packs each item up to max_cmd_width cells. If the
    # current prompt exceeds that, two-line lets it occupy the full second row
    # and avoid mid-sentence truncation.
    if not cmds:
        return False
    current_w = _visual_width(cmds[-1][1].replace("\n", " "))
    return current_w > max_cmd_width


# ──────────────────────────────────────────────────────────────────────────────
# CLI — only the three subcommands actually wired into the plugin's hooks
# and statusline. log runs in UserPromptSubmit; statusline/render are called
# by Claude Code's statusLine command. No user-facing browse commands.
# ──────────────────────────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="session-cmds",
        description="Internal CLI for the prompthud plugin.",
    )
    p.add_argument("--session-id", help="Override session ID (default: auto-detect)")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("log", help="Hook: read UserPromptSubmit JSON from stdin and append to log")

    p_sl = sub.add_parser("statusline", help="Full standalone HUD (model/git/ctx header + prompts row)")
    p_sl.add_argument("--width", type=int, default=0,
                      help="Total max cells for cmds row (0 = auto-detect)")
    p_sl.add_argument("--max-cmd-width", type=int, default=30,
                      help="Max cells per command item")
    p_sl.add_argument("--lines", choices=["1", "2", "auto"], default="auto",
                      help="Force single-line, two-line, or auto-pick (default)")
    p_sl.add_argument("--compact", action="store_true",
                      help="Skip the model/git/ctx header row to save vertical space")

    p_render = sub.add_parser("render", help="Prompts row only (for wrapping other statuslines)")
    p_render.add_argument("--width", type=int, default=0,
                          help="Total max cells (0 = auto-detect)")
    p_render.add_argument("--max-cmd-width", type=int, default=30,
                          help="Max cells per prompt item")
    p_render.add_argument("--lines", choices=["1", "2", "auto"], default="auto",
                          help="Force single-line, two-line, or auto-pick (default)")

    return p


HANDLERS = {
    "log": cmd_log,
    "statusline": cmd_statusline,
    "render": cmd_render,
}


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return HANDLERS[args.command](args)
    except BrokenPipeError:
        return 0


if __name__ == "__main__":
    sys.exit(main())
