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
#   2. Where is Vortex's Wine prefix, and which build of the extension is in it?
#   3. Does the 7z that Vortex actually uses work on this system?
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
  EHCOLL=""
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

# Two things this got wrong before, both of which produced a confident WRONG
# negative — the worst shape a diagnostic can have:
#
#   1. It picked the first prefix that merely had a drive_c, then reported
#      "not found" about THAT prefix — which was never Vortex's. A prefix is
#      only the right one if Vortex is actually in it, so search by Vortex's
#      own marker (AppData/Roaming/Vortex) and report every candidate.
#   2. Depth. From drive_c the standard plugin path
#        users/<user>/AppData/Roaming/Vortex/plugins/vortex-event-horizon
#      is SEVEN levels down; the old -maxdepth 6 could not reach it and said
#      "not found" every time. Measured, not guessed.

VORTEX_PREFIX=""
VORTEX_DIR=""
SCANNED=0

for c in \
  "$HOME/Games/umu"/* \
  "$HOME/.local/share/umu"* \
  "$HOME/.steam/steam/steamapps/compatdata"/*/pfx \
  "$HOME/.local/share/Steam/steamapps/compatdata"/*/pfx \
  "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata"/*/pfx \
  "$HOME/.wine" \
  "$HOME/Games"/*/pfx \
  "$HOME/.local/share/lutris/prefixes"/* ; do
  [ -d "$c/drive_c" ] || continue
  SCANNED=$(( SCANNED + 1 ))
  # Vortex's roaming data dir is the marker: it exists whenever Vortex has run
  # in this prefix, even if our extension failed to install.
  v="$(find "$c/drive_c" -maxdepth 6 -type d -path '*/AppData/Roaming/Vortex' -print -quit 2>/dev/null)"
  if [ -n "$v" ]; then
    say "prefix:  $c   <- Vortex found here"
    VORTEX_PREFIX="$c"
    VORTEX_DIR="$v"
    break
  fi
done

say "prefixes scanned: $SCANNED"

# Last resort: a bounded sweep of the whole home dir. Slower, but a miss here
# is real rather than an artefact of guessing the wrong directory list.
if [ -z "$VORTEX_PREFIX" ]; then
  say "no Vortex in the usual locations — sweeping \$HOME (this takes a moment)"
  VORTEX_DIR="$(find "$HOME" -maxdepth 12 -type d -path '*/AppData/Roaming/Vortex' -print -quit 2>/dev/null)"
  if [ -n "$VORTEX_DIR" ]; then
    # Walk back up to the prefix root (the parent of drive_c).
    VORTEX_PREFIX="${VORTEX_DIR%%/drive_c/*}"
    say "prefix:  $VORTEX_PREFIX   <- found by sweep"
  fi
fi

if [ -z "$VORTEX_DIR" ]; then
  say "RESULT:  Vortex's data directory was NOT found anywhere under \$HOME."
  say "         That is a real finding, not a search failure — but if you know"
  say "         where the prefix is, run:"
  say "           ls \"<prefix>/drive_c/users\"/*/AppData/Roaming/Vortex"
else
  say "vortex data: $VORTEX_DIR"

  EXT="$VORTEX_DIR/plugins/vortex-event-horizon"
  if [ -d "$EXT" ]; then
    say "ext dir: $EXT"
    if [ -r "$EXT/info.json" ]; then
      say "version: $(grep -o '\"version\"[[:space:]]*:[[:space:]]*\"[^\"]*\"' "$EXT/info.json" | head -1 | sed 's/.*:[[:space:]]*"//;s/"$//')"
    fi
    # Which fixes are present tells us whether this is a current build.
    for f in dist/core/manifest/diagnoseArchive.js dist/core/revealPath.js \
             dist/core/installer/checkPluginOrder.js ; do
      if [ -f "$EXT/$f" ]; then
        say "build:   has $(basename "$f")"
      else
        say "build:   MISSING $(basename "$f")  <- OLDER BUILD, re-pull and rebuild"
      fi
    done
  else
    say "ext dir: NOT present at $EXT"
    say "         (the extension is not installed in this prefix)"
  fi
fi

# ── 4. The 7z Vortex actually uses ───────────────────────────────────────────
line
say "[4] VORTEX'S BUNDLED 7z"

# `find` exits 0 when it matches nothing, so the old `find ... || say "(none)"`
# never fired and an empty result printed as an empty heading — indistinguishable
# from "the section did not run". Capture, then test the capture.
SEVENZIP_LIST=""
if [ -n "$VORTEX_PREFIX" ]; then
  SEVENZIP_LIST="$(find "$VORTEX_PREFIX/drive_c" -maxdepth 12 \
    \( -iname '7z.exe' -o -iname '7za.exe' -o -iname '7z.dll' -o -iname '7z.so' \) \
    -printf '  %s bytes  %p\n' 2>/dev/null)"
fi

if [ -n "$SEVENZIP_LIST" ]; then
  say "found:"
  printf '%s\n' "$SEVENZIP_LIST" | head -10
else
  say "found:   NONE under the Vortex prefix."
  if [ -z "$VORTEX_PREFIX" ]; then
    say "         (no prefix identified, so this checked nothing — not a result)"
  else
    say "         Vortex ships 7z with itself, so an empty list here is worth"
    say "         reporting: it means the file Vortex calls to open archives"
    say "         is not where it should be."
  fi
fi

# ── 5. The decisive test: can that 7z read the file? ─────────────────────────
line
say "[5] CAN 7z READ THE COLLECTION?"

# Sections 1-2 can prove the file is fine. Only this can prove 7z is fine.
# Read-only: `l` lists an archive, it does not extract or modify anything.

if [ -z "$EHCOLL" ]; then
  say "skipped: no collection file to test."
elif command -v 7z >/dev/null 2>&1; then
  say "-- native linux 7z --"
  if 7z l "$EHCOLL" >/dev/null 2>&1; then
    say "   reads OK  (so the FILE is fine; any failure is Wine-side)"
  else
    say "   FAILED    (surprising, given unzip could read it — paste the error:)"
    7z l "$EHCOLL" 2>&1 | tail -5
  fi
else
  say "-- native linux 7z: not installed, skipped --"
fi

# And the one that matters: the Windows 7z binary, run through Wine, on the
# same path Vortex would hand it.
WINE_BIN=""
if [ -n "$EHCOLL" ]; then
for w in "${WINE:-}" wine wine64 ; do
  [ -n "$w" ] && command -v "$w" >/dev/null 2>&1 && { WINE_BIN="$w"; break; }
done

SEVENZIP_EXE="$(printf '%s\n' "$SEVENZIP_LIST" | grep -i -m1 '7za\?\.exe' | sed 's/^ *[0-9]* bytes  //')"

if [ -z "$WINE_BIN" ]; then
  say "-- wine 7z: no 'wine' on PATH (Proton ships its own), skipped --"
  say "   To test by hand, from inside the same runtime Vortex uses:"
  say "     7z.exe l \"<the .ehcoll>\""
elif [ -z "$SEVENZIP_EXE" ]; then
  say "-- wine 7z: no 7z .exe located in section 4, nothing to run --"
else
  say "-- wine 7z: $SEVENZIP_EXE --"
  WIN_PATH="$EHCOLL"
  if command -v winepath >/dev/null 2>&1; then
    WIN_PATH="$(WINEPREFIX="$VORTEX_PREFIX" winepath -w "$EHCOLL" 2>/dev/null || printf '%s' "$EHCOLL")"
  fi
  say "   windows path: $WIN_PATH"
  if WINEPREFIX="$VORTEX_PREFIX" WINEDEBUG=-all \
     "$WINE_BIN" "$SEVENZIP_EXE" l "$WIN_PATH" >/dev/null 2>&1; then
    say "   reads OK   <<< 7z is FINE under Wine; the fault is above 7z"
  else
    say "   FAILED     <<< THIS IS THE ANSWER — 7z cannot read it under Wine"
    say "   error output:"
    WINEPREFIX="$VORTEX_PREFIX" WINEDEBUG=-all \
      "$WINE_BIN" "$SEVENZIP_EXE" l "$WIN_PATH" 2>&1 | tail -12 | sed 's/^/     /'
  fi
fi
fi

# ── 6. Extension log ─────────────────────────────────────────────────────────
line
say "[6] EVENT HORIZON LOG (last 25 lines)"
LOGFILE=""
if [ -n "$VORTEX_DIR" ] && [ -d "$VORTEX_DIR/event-horizon/logs" ]; then
  LOGFILE="$(ls -1t "$VORTEX_DIR/event-horizon/logs"/*.log 2>/dev/null | head -1)"
fi
if [ -n "$LOGFILE" ]; then
  say "log: $LOGFILE"
  tail -n 25 "$LOGFILE"
elif [ -n "$VORTEX_DIR" ]; then
  say "no log yet at $VORTEX_DIR/event-horizon/logs"
  say "(the extension writes one on first run — none means it has not run)"
else
  say "skipped: Vortex data directory not located."
fi

line
say "END OF REPORT — copy everything above this line."
