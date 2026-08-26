#!/usr/bin/env bash
# =============================================================================
# Event Horizon — install diagnostic
#
# Run this on the LINUX side (your normal terminal), not inside Wine.
#
# It only READS things. It does not install, delete, modify or send anything —
# copy the output back yourself and check it first.
#
# Usage:
#   bash diagnose-install.sh
#   bash diagnose-install.sh /path/to/ivy-2-1.0.9.ehcoll     # if not found
#
# What it answers:
#   1. Is the .ehcoll file complete, or did the transfer cut it short?
#   2. Does 7z work on this system at all?
#   3. Where is Vortex's Wine prefix, and which build of the extension is it
#      running?
# =============================================================================

set -u

# The size and hash of the package as it exists on the CURATOR's machine.
# If yours differs, the transfer is the problem and nothing else here matters.
EXPECTED_BYTES="${EXPECTED_BYTES:-157984816}"

line() { printf '%s\n' "-------------------------------------------------------------"; }
say()  { printf '%s\n' "$*"; }

say "============================================================="
say "Event Horizon install diagnostic"
say "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
say "============================================================="

# ── 1. System ────────────────────────────────────────────────────────────────
line
say "[1] SYSTEM"
say "kernel:  $(uname -srm 2>/dev/null || echo unknown)"
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release 2>/dev/null && say "distro:  ${PRETTY_NAME:-unknown}"
fi
# `command -v python3` is not enough: Windows ships a shim that exists and
# then prints a store advert instead of running. Ask it to do something.
HAVE_PY=no
if python3 -c 'pass' >/dev/null 2>&1; then HAVE_PY=yes; fi
say "python3: $([ "$HAVE_PY" = yes ] && python3 --version 2>&1 || echo 'not usable')"
say "unzip:   $(command -v unzip >/dev/null 2>&1 && echo present || echo 'not installed')"
say "7z:      $(command -v 7z >/dev/null 2>&1 && echo present || echo 'not installed (this is fine — Vortex ships its own)')"

# ── 2. Find the package ──────────────────────────────────────────────────────
line
say "[2] THE COLLECTION FILE"

EHCOLL="${1:-}"
if [ -z "$EHCOLL" ]; then
  # Look where a chat client or browser would have put it. -print -quit stops
  # at the first hit so this stays fast on a big home directory.
  EHCOLL="$(find "$HOME" -maxdepth 5 -type f -name '*.ehcoll' -print -quit 2>/dev/null)"
fi

if [ -z "$EHCOLL" ] || [ ! -f "$EHCOLL" ]; then
  say "NOT FOUND. Pass the path explicitly:"
  say "  bash diagnose-install.sh \"/home/you/Downloads/Telegram Desktop/ivy-2-1.0.9.ehcoll\""
else
  say "path:     $EHCOLL"
  ACTUAL_BYTES="$(stat -c%s "$EHCOLL" 2>/dev/null || stat -f%z "$EHCOLL" 2>/dev/null || echo 0)"
  say "size:     $ACTUAL_BYTES bytes"
  say "expected: $EXPECTED_BYTES bytes"
  if [ "$ACTUAL_BYTES" = "$EXPECTED_BYTES" ]; then
    say "          -> SIZE MATCHES"
  else
    DIFF=$(( EXPECTED_BYTES - ACTUAL_BYTES ))
    say "          -> SIZE DIFFERS by $DIFF bytes  <<< likely the whole answer"
  fi

  # Structure. A ZIP's central directory is at the END, so a cut-short
  # transfer has a perfect header and no end-of-central-directory record.
  if [ "$HAVE_PY" = yes ]; then
    python3 - "$EHCOLL" <<'PYEOF'
import sys
p = sys.argv[1]
with open(p, "rb") as f:
    head = f.read(4)
    f.seek(0, 2)
    size = f.tell()
    tail_len = min(size, 66000)
    f.seek(size - tail_len)
    tail = f.read(tail_len)
print("header:  ", "ZIP (PK\\x03\\x04) OK" if head == b"PK\x03\x04" else f"NOT a zip header: {head!r}")
print("trailer: ", "end-of-central-directory FOUND" if tail.find(b"PK\x05\x06") != -1
      else "end-of-central-directory MISSING -> file is TRUNCATED")
PYEOF
  else
    # Coreutils-only fallback. Same two questions: is the header a ZIP local
    # file header, and does an end-of-central-directory record appear in the
    # last 64KB. Hex-dump and string-match, no interpreter required.
    HEAD_HEX="$(head -c 4 "$EHCOLL" | od -An -tx1 -v 2>/dev/null | tr -d '[:space:]')"
    if [ "$HEAD_HEX" = "504b0304" ]; then
      say "header:   ZIP (PK\x03\x04) OK"
    else
      say "header:   NOT a zip header (bytes: $HEAD_HEX)"
    fi
    TAIL_HITS="$(tail -c 66000 "$EHCOLL" | od -An -tx1 -v 2>/dev/null | tr -d '[:space:]' | grep -c '504b0506')"
    if [ "${TAIL_HITS:-0}" -gt 0 ]; then
      say "trailer:  end-of-central-directory FOUND"
    else
      say "trailer:  end-of-central-directory MISSING -> file is TRUNCATED"
    fi
  fi

  # sha256 lets you compare against the sender byte-for-byte.
  if command -v sha256sum >/dev/null 2>&1; then
    say "sha256:   $(sha256sum "$EHCOLL" | cut -d' ' -f1)"
  fi

  # Can any local tool read it? This separates "the file is bad" from
  # "Vortex's 7z is bad" without touching Vortex at all.
  if command -v unzip >/dev/null 2>&1; then
    say "unzip -l: $(unzip -l "$EHCOLL" >/dev/null 2>&1 && echo 'reads OK' || echo 'FAILED to read')"
    say "manifest: $(unzip -l "$EHCOLL" 2>/dev/null | grep -c 'manifest.json') entry(ies) named manifest.json"
  elif command -v 7z >/dev/null 2>&1; then
    say "7z l:     $(7z l "$EHCOLL" >/dev/null 2>&1 && echo 'reads OK' || echo 'FAILED to read')"
  else
    say "readable: skipped (no unzip or 7z on the Linux side)"
  fi
fi

# ── 3. Wine prefix and Vortex ────────────────────────────────────────────────
line
say "[3] VORTEX / WINE PREFIX"

# Common locations for a umu / Proton / Lutris / Bottles prefix holding Vortex.
PREFIX=""
for c in \
  "$HOME/Games/umu"/* \
  "$HOME/.local/share/umu"* \
  "$HOME/.steam/steam/steamapps/compatdata"/*/pfx \
  "$HOME/.local/share/Steam/steamapps/compatdata"/*/pfx \
  "$HOME/.wine" \
  "$HOME/Games"/*/pfx \
  "$HOME/.local/share/lutris/prefixes"/* ; do
  [ -d "$c/drive_c" ] || continue
  if find "$c/drive_c" -maxdepth 6 -type d -name "vortex-event-horizon" -print -quit 2>/dev/null | grep -q .; then
    PREFIX="$c"; break
  fi
  [ -z "$PREFIX" ] && PREFIX="$c"
done

if [ -z "$PREFIX" ]; then
  say "prefix:  NOT FOUND automatically."
  say "         Run:  find \$HOME -maxdepth 6 -type d -name drive_c 2>/dev/null"
else
  say "prefix:  $PREFIX"
  EXT="$(find "$PREFIX/drive_c" -maxdepth 8 -type d -name 'vortex-event-horizon' -print -quit 2>/dev/null)"
  if [ -n "$EXT" ]; then
    say "ext dir: $EXT"
    if [ -r "$EXT/info.json" ]; then
      say "version: $(grep -o '\"version\"[^,]*' "$EXT/info.json" | head -1)"
    fi
    # Which fixes are present tells us whether he is on a current build.
    for f in dist/core/manifest/diagnoseArchive.js dist/core/revealPath.js \
             dist/core/installer/checkPluginOrder.js ; do
      [ -f "$EXT/$f" ] && say "build:   has $(basename "$f")" || say "build:   MISSING $(basename "$f")  <- older build"
    done
  else
    say "ext dir: not found under this prefix"
  fi

  # Vortex bundles its own 7z. If this is absent, that is the answer.
  say "bundled 7z binaries found:"
  find "$PREFIX/drive_c" -maxdepth 10 \( -iname '7z.exe' -o -iname '7za.exe' -o -iname '7z.dll' \) \
    -printf '  %s bytes  %p\n' 2>/dev/null | head -8 || say "  (none found)"
fi

# ── 4. Extension log ─────────────────────────────────────────────────────────
line
say "[4] EVENT HORIZON LOG (last 25 lines)"
LOGDIR=""
if [ -n "$PREFIX" ]; then
  LOGDIR="$(find "$PREFIX/drive_c" -maxdepth 10 -type d -path '*event-horizon/logs' -print -quit 2>/dev/null)"
fi
if [ -n "$LOGDIR" ]; then
  LOGFILE="$(ls -1t "$LOGDIR"/*.log 2>/dev/null | head -1)"
  say "log: $LOGFILE"
  [ -n "$LOGFILE" ] && tail -n 25 "$LOGFILE"
else
  say "log dir not found (expected under .../AppData/Roaming/Vortex/event-horizon/logs)"
fi

line
say "END OF REPORT — copy everything above this line."
