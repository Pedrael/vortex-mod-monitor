#!/usr/bin/env bash
# =============================================================================
# Event Horizon — Proton/Wine prefix setup
#
# Run this on the LINUX side, in your normal terminal. Not inside Wine.
#
# WHAT PROBLEM THIS SOLVES
#   Vortex ships its own 7-Zip (7z.exe + 7z.dll) inside its app directory and
#   uses it to unpack every mod archive. Event Horizon does NOT need it to
#   read a collection any more -- we parse that ourselves -- but Vortex needs
#   it to install the mods inside one. On a Wine/Proton prefix that 7z.exe is
#   frequently unable to start, usually because the Visual C++ runtime it
#   links against is not present in the prefix.
#
#   You do NOT need to install 7-Zip. It is already there. What is missing is
#   the runtime underneath it.
#
# DO YOU EVEN NEED THIS?
#   Probably not. Event Horizon reads collections without 7-Zip at all now, so
#   the only thing that still needs it is Vortex unpacking mod archives — and
#   Event Horizon TESTS that when you load a collection and warns you if it is
#   broken. If it has not warned you, nothing here needs fixing and --apply
#   will change your prefix for no reason. Run it without --apply first; that
#   only looks.
#
# SAFETY
#   By default this only LOOKS and REPORTS. It changes nothing.
#   Pass --apply to actually install runtimes, and it will still tell you
#   exactly what it is about to run and wait for you to type "yes".
#   It never deletes anything, and never touches your game files or mods.
#
# USAGE
#   bash setup-proton.sh                 # report only  (safe, default)
#   bash setup-proton.sh --apply         # install, with confirmation
#   bash setup-proton.sh --apply --yes   # install, no prompt (for scripts)
#   bash setup-proton.sh --prefix /path/to/pfx    # skip auto-detection
# =============================================================================

set -u

APPLY=no
ASSUME_YES=no
PREFIX_ARG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=yes ;;
    --yes|-y) ASSUME_YES=yes ;;
    --prefix) shift; PREFIX_ARG="${1:-}" ;;
    -h|--help) sed -n '2,31p' "$0"; exit 0 ;;
    *) printf 'Unknown option: %s (try --help)\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

line() { printf '%s\n' "-------------------------------------------------------------"; }
say()  { printf '%s\n' "$*"; }

say "============================================================="
say "Event Horizon — Proton prefix setup"
say "mode: $([ "$APPLY" = yes ] && echo 'APPLY (will make changes)' || echo 'report only (changes nothing)')"
say "============================================================="

# ── 1. Find the prefix Vortex actually runs in ───────────────────────────────
line
say "[1] VORTEX PREFIX"

# Vortex's roaming data dir is the marker: it exists whenever Vortex has run in
# a prefix. Searching for OUR extension instead would miss a prefix where the
# extension failed to install, which is exactly when you need this script.
#
# Depth matters: from drive_c that path is five levels down
# (users/<user>/AppData/Roaming/Vortex). The diagnostic script shipped with a
# limit one level too shallow and reported "not found" every single time.
VORTEX_DIR=""
PREFIX=""

if [ -n "$PREFIX_ARG" ]; then
  PREFIX="$PREFIX_ARG"
  VORTEX_DIR="$(find "$PREFIX/drive_c" -maxdepth 6 -type d -path '*/AppData/Roaming/Vortex' -print -quit 2>/dev/null)"
  if [ -z "$VORTEX_DIR" ]; then
    say "WARNING: no Vortex data dir under the prefix you gave. Continuing anyway."
  fi
else
  for c in \
    "$HOME/.vortex-linux/compatdata/pfx" \
    "$HOME/Games/umu"/* \
    "$HOME/.local/share/umu"* \
    "$HOME/.steam/steam/steamapps/compatdata"/*/pfx \
    "$HOME/.local/share/Steam/steamapps/compatdata"/*/pfx \
    "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/compatdata"/*/pfx \
    "$HOME/.wine" \
    "$HOME/Games"/*/pfx \
    "$HOME/.local/share/lutris/prefixes"/* ; do
    [ -d "$c/drive_c" ] || continue
    v="$(find "$c/drive_c" -maxdepth 6 -type d -path '*/AppData/Roaming/Vortex' -print -quit 2>/dev/null)"
    if [ -n "$v" ]; then PREFIX="$c"; VORTEX_DIR="$v"; break; fi
  done

  if [ -z "$PREFIX" ]; then
    say "not in the usual places — sweeping \$HOME (a moment)"
    VORTEX_DIR="$(find "$HOME" -maxdepth 12 -type d -path '*/AppData/Roaming/Vortex' -print -quit 2>/dev/null)"
    [ -n "$VORTEX_DIR" ] && PREFIX="${VORTEX_DIR%%/drive_c/*}"
  fi
fi

if [ -z "$PREFIX" ]; then
  say "RESULT: could not find a Wine prefix containing Vortex."
  say "        Pass it explicitly:  bash setup-proton.sh --prefix /path/to/pfx"
  say "        (the prefix is the directory that CONTAINS drive_c)"
  exit 1
fi

say "prefix:      $PREFIX"
[ -n "$VORTEX_DIR" ] && say "vortex data: $VORTEX_DIR"

# ── 2. Is Vortex's 7-Zip actually there? ─────────────────────────────────────
line
say "[2] VORTEX'S BUNDLED 7-ZIP"

# find exits 0 when it matches nothing, so `find ... || echo none` never fires.
# Capture, then test the capture.
# List them ALL rather than taking the first hit. A tester's run reported
# "C:/Program Files/7-Zip/7z.exe" — a standalone 7-Zip that happened to sort
# first — while the copy Vortex actually loads lives under its own
# resources/app.asar.unpacked. Naming the wrong binary sends the reader to
# check something Vortex never touches.
ALL_SEVENZIP="$(find "$PREFIX/drive_c" -maxdepth 12 -iname '7z.exe' 2>/dev/null)"
# The one that matters is Vortex's own. Match its BUNDLE LAYOUT, not the word
# "vortex": the tester's prefix is literally named ~/.vortex-linux, so every
# path under it contains "vortex" and the standalone 7-Zip was picked as
# "Vortex's" while Vortex's actual copy was listed as an also-ran. `7z-bin`
# and `app.asar` are Electron-bundle markers a standalone install never has.
SEVENZIP="$(printf '%s\n' "$ALL_SEVENZIP" | grep -E '7z-bin|app\.asar' | head -1)"
[ -z "$SEVENZIP" ] && SEVENZIP="$(printf '%s\n' "$ALL_SEVENZIP" | head -1)"

if [ -n "$SEVENZIP" ]; then
  say "vortex's:  $SEVENZIP"
  others="$(printf '%s\n' "$ALL_SEVENZIP" | grep -v -F "$SEVENZIP" | grep -v '^$')"
  if [ -n "$others" ]; then
    say "others:"
    printf '%s\n' "$others" | sed 's/^/  /'
    say "  (a separately installed 7-Zip is not the one Vortex loads)"
  fi
  say "        So 7-Zip is NOT missing. If extraction fails, the runtime it"
  say "        needs is what's absent — which is what this script installs."
else
  say "found:  NONE under this prefix."
  say "        That is unusual: Vortex ships 7z.exe with itself. A reinstall of"
  say "        Vortex inside this prefix is more likely to help than runtimes."
fi

# ── 3. What tool can modify this prefix? ─────────────────────────────────────
line
say "[3] TOOLING"

# A Steam compatdata prefix is keyed by appid and is protontricks' native case.
# A custom prefix (Vortex-on-Linux installers commonly make one under
# ~/.vortex-linux) is not a Steam app at all, so protontricks-by-appid cannot
# address it and winetricks with WINEPREFIX is the general answer.
APPID=""
case "$PREFIX" in
  */steamapps/compatdata/*/pfx)
    APPID="$(printf '%s' "$PREFIX" | sed -n 's#.*/compatdata/\([0-9][0-9]*\)/pfx.*#\1#p')"
    ;;
esac

HAVE_PROTONTRICKS=no
HAVE_WINETRICKS=no
command -v protontricks >/dev/null 2>&1 && HAVE_PROTONTRICKS=yes
command -v winetricks   >/dev/null 2>&1 && HAVE_WINETRICKS=yes
# Flatpak protontricks is common on Arch/Steam Deck and is not on PATH.
FLATPAK_PT=no
if command -v flatpak >/dev/null 2>&1; then
  flatpak list --app 2>/dev/null | grep -qi 'protontricks' && FLATPAK_PT=yes
fi

say "steam appid:  ${APPID:-<not a Steam prefix>}"
say "protontricks: $HAVE_PROTONTRICKS"
say "  (flatpak):  $FLATPAK_PT"
say "winetricks:   $HAVE_WINETRICKS"

# ── 3b. WHICH wine owns this prefix? ─────────────────────────────────────────
#
# This is the step the first version of the script got wrong, and the tester's
# output showed it plainly:
#
#   wine client error:0: version mismatch 856/961.
#
# winetricks uses whatever `wine` is on PATH. A prefix created by Proton is
# owned by PROTON's wine, and the two refuse to talk to each other — so
# winetricks could not read `%AppData%`, never installed anything, and exited
# 1. That is not a runtime problem, it is the wrong runtime.
#
# winetricks honours $WINE and $WINESERVER, so the fix is to find the wine
# that lives with the prefix and point it there. Searched nearest-first: the
# runtime shipped alongside the prefix is the one that made it.
OWNING_WINE=""
OWNING_WINE_HOW=""

# Proton records which build created a prefix, next to the prefix itself.
# Reading it turns "some Proton I found" into "the build this prefix says made
# it" — and where it cannot be read, saying so is better than presenting a
# guess as a fact. The tester's run picked a wine from the LAST-RESORT branch
# and reported it in the same tone as a certainty.
PREFIX_PARENT="$(dirname "$PREFIX")"
PROTON_BUILD=""
for vf in "$PREFIX_PARENT/version" "$PREFIX_PARENT/config_info"; do
  if [ -r "$vf" ]; then
    PROTON_BUILD="$(head -1 "$vf" 2>/dev/null | tr -d '\r')"
    [ -n "$PROTON_BUILD" ] && break
  fi
done

find_owning_wine() {
  # 0. The build the prefix NAMES, if it named one and it is installed. This
  #    is the only branch that is evidence rather than proximity.
  if [ -n "$PROTON_BUILD" ]; then
    for base in \
      "$HOME/.steam/steam/steamapps/common" \
      "$HOME/.local/share/Steam/steamapps/common" ; do
      [ -d "$base" ] || continue
      while IFS= read -r d; do
        [ -x "$d/files/bin/wine" ] && {
          OWNING_WINE="$d/files/bin/wine"
          OWNING_WINE_HOW="matches the build this prefix records ($PROTON_BUILD)"
          return 0
        }
      done <<EOF
$(find "$base" -maxdepth 1 -type d -name "*${PROTON_BUILD}*" 2>/dev/null)
EOF
    done
  fi
  find_owning_wine_by_location
}

find_owning_wine_by_location() {
  # 1. A runtime shipped inside the same tree as the prefix (this is the
  #    ~/.vortex-linux case: it carries its own Proton).
  root="${PREFIX%/compatdata/*}"
  [ "$root" = "$PREFIX" ] && root="$(dirname "$PREFIX")"
  for c in \
    "$root"/files/bin/wine \
    "$root"/dist/bin/wine \
    "$root"/*/files/bin/wine \
    "$root"/*/dist/bin/wine \
    "$root"/proton*/files/bin/wine \
    "$root"/../files/bin/wine ; do
    [ -x "$c" ] && {
      OWNING_WINE="$c"
      OWNING_WINE_HOW="ships alongside the prefix"
      return 0
    }
  done
  # 2. umu, which is how a lot of non-Steam Proton prefixes are driven.
  for c in "$HOME/.local/share/umu"/*/files/bin/wine ; do
    [ -x "$c" ] && {
      OWNING_WINE="$c"
      OWNING_WINE_HOW="umu runtime"
      return 0
    }
  done
  # 3. A Steam Proton install. Last resort: any of these may be the WRONG
  #    build for this prefix, which is why it is searched last — and why it
  #    is reported as a guess rather than in the same tone as the branches
  #    above. The tester's run landed here and said nothing about it.
  for c in \
    "$HOME/.steam/steam/steamapps/common"/Proton*/files/bin/wine \
    "$HOME/.local/share/Steam/steamapps/common"/Proton*/files/bin/wine ; do
    [ -x "$c" ] && {
      OWNING_WINE="$c"
      OWNING_WINE_HOW="A GUESS — first Proton on the system, not verified against this prefix"
      return 0
    }
  done
  return 1
}
find_owning_wine || true

if [ -n "$OWNING_WINE" ]; then
  say "prefix's wine: $OWNING_WINE"
  say "               ($OWNING_WINE_HOW)"
  [ -n "$PROTON_BUILD" ] && say "prefix records: $PROTON_BUILD"
  case "$OWNING_WINE_HOW" in
    A\ GUESS*)
      say ""
      say "  NOTE: that was a guess. If it is the wrong build you will get"
      say "  'version mismatch' again and nothing will be installed. The"
      say "  runtime Vortex launches with is the right one — if you know"
      say "  where it is, pass it by hand:"
      say "    WINE=/path/to/wine WINESERVER=/path/to/wineserver \\"
      say "      WINEPREFIX=\"$PREFIX\" winetricks vcrun2022"
      ;;
  esac
else
  say "prefix's wine: not found — will use whatever wine is on PATH, which"
  say "               fails with a 'version mismatch' on a Proton prefix."
fi

# Decide the command.
#
# An ARRAY, not a string. The runtime that turned up on the tester's machine
# was ".../Proton - Experimental/files/bin/wine", and a string runner is
# word-split on execution: that path becomes "WINE=.../Proton", a bare "-",
# and "Experimental/...", which fails in a way that looks like anything but a
# quoting bug. Spaces in Proton build names are the norm, not the exception.
RUNNER_CMD=()
RUNNER_DESC=""
if [ -n "$APPID" ] && [ "$HAVE_PROTONTRICKS" = yes ]; then
  # protontricks finds the right Proton for a Steam app itself. Preferred
  # precisely because it does not have the problem above.
  RUNNER_CMD=(protontricks "$APPID")
  RUNNER_DESC="protontricks, addressing the Steam app by id"
elif [ -n "$APPID" ] && [ "$FLATPAK_PT" = yes ]; then
  RUNNER_CMD=(flatpak run com.github.Matoking.protontricks "$APPID")
  RUNNER_DESC="protontricks via flatpak"
elif [ "$HAVE_WINETRICKS" = yes ] && [ -n "$OWNING_WINE" ]; then
  RUNNER_CMD=(env "WINEPREFIX=$PREFIX" "WINE=$OWNING_WINE" \
    "WINESERVER=$(dirname "$OWNING_WINE")/wineserver" winetricks)
  RUNNER_DESC="winetricks driven by the prefix's OWN wine (not the one on PATH)"
elif [ "$HAVE_WINETRICKS" = yes ]; then
  RUNNER_CMD=(env "WINEPREFIX=$PREFIX" winetricks)
  RUNNER_DESC="winetricks with the system wine — EXPECTED TO FAIL on a Proton prefix"
fi

# Shell-quote for DISPLAY. The printed command is copy-pasted by hand at least
# as often as --apply is used, so an unquoted one is the same bug twice.
shq() {
  for a in "$@"; do
    case "$a" in
      *[!A-Za-z0-9=/._-]*) printf "'%s' " "$(printf '%s' "$a" | sed "s/'/'\\\\''/g")" ;;
      *) printf '%s ' "$a" ;;
    esac
  done
}

# The runtimes worth installing, most likely first. 7-Zip itself is NOT here:
# Vortex ships it, and installing another copy would not change which binary
# Vortex loads.
VERBS="vcrun2022"

if [ ${#RUNNER_CMD[@]} -eq 0 ]; then
  line
  say "NOTHING TO RUN: neither protontricks nor winetricks is installed."
  say ""
  say "Install one, then re-run this script:"
  say "  Arch/EndeavourOS:  sudo pacman -S winetricks   (or: yay -S protontricks)"
  say "  Fedora:            sudo dnf install winetricks"
  say "  Debian/Ubuntu:     sudo apt install winetricks"
  say "  Flatpak (any):     flatpak install com.github.Matoking.protontricks"
  exit 1
fi

# ── 4. The plan ──────────────────────────────────────────────────────────────
line
say "[4] PLAN"
say "using:   $RUNNER_DESC"
say "command: $(shq "${RUNNER_CMD[@]}" $VERBS)"
say ""
say "This installs the Visual C++ runtime into the Vortex prefix only."
say "It does not touch your games, your mods, or anything outside that prefix."
say "It does not remove or overwrite anything you installed yourself."

if [ "$APPLY" != yes ]; then
  line
  say "REPORT ONLY — nothing was changed."
  say "To actually run the command above:"
  say "  bash setup-proton.sh --apply"
  exit 0
fi

# ── 5. Consent, then do it ───────────────────────────────────────────────────
line
if [ "$ASSUME_YES" != yes ]; then
  printf 'Run the command above? Type yes to continue: '
  read -r reply || reply=""
  case "$reply" in
    yes|YES|y|Y) ;;
    *) say "Aborted. Nothing was changed."; exit 0 ;;
  esac
fi

say "running: $(shq "${RUNNER_CMD[@]}" $VERBS)"
# Captured as well as shown, so the specific failures below can be recognised
# rather than reported as a bare exit code. `tee` keeps the live output.
RUN_LOG="$(mktemp 2>/dev/null || printf '/tmp/eh-setup-%s.log' "$$")"
# The status of a PIPELINE is its LAST command's -- here `tee`, which always
# succeeds. Testing it directly reported DONE for a run that installed
# nothing, which is worse than the bare exit code this replaced. PIPESTATUS
# holds the real one and is clobbered by the very next command, so it must be
# read on the line immediately after the pipeline and nowhere later.
# shellcheck disable=SC2086
"${RUNNER_CMD[@]}" $VERBS 2>&1 | tee "$RUN_LOG"
RC="${PIPESTATUS[0]}"

line
if [ "$RC" = 0 ]; then
  say "DONE. Restart Vortex, then try the install again."
  say "Event Horizon checks the extractor when you load a collection and will"
  say "tell you if it still is not working."
elif grep -qiE 'version mismatch|wineserver binary was not upgraded' "$RUN_LOG" 2>/dev/null; then
  # The one failure that is NOT ambiguous, and the one a tester actually hit.
  # Calling it "not necessarily fatal" wasted their time: nothing was
  # installed and nothing was going to be.
  say "NOTHING WAS INSTALLED — wrong wine for this prefix."
  say ""
  say "  wine client error: version mismatch"
  say ""
  say "The wine that ran is not the one that owns this prefix, so it could not"
  say "open it at all. This is not a problem with your prefix or with 7-Zip."
  if [ -z "$OWNING_WINE" ]; then
    say ""
    say "This script could not find the wine that Vortex uses. Find it with:"
    say "  find \"\$HOME/.vortex-linux\" -name wine -type f -perm -u+x 2>/dev/null"
    say "then re-run pointing at it:"
    say "  WINE=/path/to/wine WINESERVER=/path/to/wineserver \\"
    say "    WINEPREFIX=\"$PREFIX\" winetricks vcrun2022"
  else
    say ""
    say "It used: $OWNING_WINE"
    say "If that is not the runtime Vortex launches with, pass the right one:"
    say "  WINE=/path/to/wine WINESERVER=/path/to/wineserver \\"
    say "    WINEPREFIX=\"$PREFIX\" winetricks vcrun2022"
  fi
  say ""
  say "Worth checking first: you may not need this at all. Event Horizon only"
  say "needs Vortex's 7-Zip for unpacking mods, and it tells you on load if"
  say "that is broken. If it has not warned you, nothing here needs fixing."
else
  say "The command exited with status $RC."
  say ""
  say "That is not necessarily fatal — winetricks reports non-zero for several"
  say "harmless reasons. Restart Vortex and try the install; if Event Horizon"
  say "still warns about the extractor, paste the output above along with:"
  say "  bash scripts/diagnose-install.sh"
fi
