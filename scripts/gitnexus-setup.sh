#!/usr/bin/env bash
# scripts/gitnexus-setup.sh — one-time GitNexus bootstrap for new contributors.
#
# Stores the OpenAI key in ~/.gitnexus/config.json (per-developer, global)
# so we never collide with .zshrc OPENAI_API_KEY overrides and never risk
# committing a key to the repo. Then runs the first full analyze with
# embeddings + skills so the index is ready for `query`, `impact`, etc.
#
# This script is intentionally project-agnostic — drop it into any repo.
# It auto-detects the project name (from package.json) and package manager
# (pnpm-lock.yaml > yarn.lock > package-lock.json).
#
# Usage (from repo root):
#   bash scripts/gitnexus-setup.sh
#   pnpm gitnexus:setup     # if added to package.json
#   npm run gitnexus:setup  # if added to package.json
#
# Idempotent — safe to re-run. Skips key prompt if a key is already saved.

set -euo pipefail

# ── Colors ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# ── Detect runtime (WSL / Git Bash / native) ───────────────────────────
# The config file has to live where Node's `os.homedir()` will look for
# it. That depends on which Node binary actually runs `gitnexus` later:
#
#   • Native Linux / macOS bash → $HOME (just works).
#   • Git Bash / MSYS / Cygwin on Windows → $HOME maps to %USERPROFILE%
#     under the hood. Just works.
#   • WSL bash → $HOME = /home/<user> (Linux). But the user typically
#     runs `gitnexus wiki` later from PowerShell, where Node's homedir()
#     returns C:\Users\<WinUser>. Two different filesystems, two
#     different homes. We have to write the config to the Windows home
#     too, otherwise the Windows-native `gitnexus wiki` can't find it.
#
# Strategy:
#   PRIMARY_HOME     — where Linux/macOS/Git-Bash gitnexus will look
#   SECONDARY_HOME   — additionally written when running under WSL, so
#                      Windows-native gitnexus invocations also see the
#                      same key. Empty on non-WSL systems.

PRIMARY_HOME="$HOME"
SECONDARY_HOME=""
RUNTIME_LABEL="native"

uname_s="$(uname -s 2>/dev/null || echo)"
uname_r="$(uname -r 2>/dev/null || echo)"

is_wsl="no"
if [[ "$uname_r" == *microsoft* || "$uname_r" == *Microsoft* || "$uname_r" == *WSL* ]]; then
  is_wsl="yes"
fi
# WSL1 sometimes hides the kernel marker; /proc/version is the fallback.
if [ "$is_wsl" = "no" ] && [ -r /proc/version ]; then
  if grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
    is_wsl="yes"
  fi
fi

if [ "$is_wsl" = "yes" ]; then
  RUNTIME_LABEL="WSL"
  # Ask Windows what its home dir is — works in any WSL distro that has
  # Windows interop enabled (the default).
  win_home_raw="$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r\n' || echo)"
  if [ -n "$win_home_raw" ] && command -v wslpath >/dev/null 2>&1; then
    win_home="$(wslpath -u "$win_home_raw" 2>/dev/null || echo)"
    if [ -n "$win_home" ] && [ -d "$win_home" ]; then
      # Windows home is the canonical one because the user runs gitnexus
      # from PowerShell most of the time. We also keep the WSL home in
      # sync so `gitnexus` invoked from inside WSL still finds the key.
      PRIMARY_HOME="$win_home"
      SECONDARY_HOME="$HOME"
    else
      echo -e "${YELLOW}⚠${NC} WSL detected but couldn't resolve Windows home from '${win_home_raw}'."
      echo "    Falling back to \$HOME — the Windows-native \`gitnexus wiki\` may not find this key."
    fi
  else
    echo -e "${YELLOW}⚠${NC} WSL detected but cmd.exe interop or wslpath is unavailable."
    echo "    Falling back to \$HOME — the Windows-native \`gitnexus wiki\` may not find this key."
  fi
elif [[ "$uname_s" == MINGW* || "$uname_s" == MSYS* || "$uname_s" == CYGWIN* ]]; then
  RUNTIME_LABEL="Git Bash on Windows"
  # $HOME under MSYS/Git Bash already points at %USERPROFILE%. Nothing
  # to translate.
fi

CONFIG_DIR="$PRIMARY_HOME/.gitnexus"
CONFIG_FILE="$CONFIG_DIR/config.json"
SECONDARY_CONFIG_DIR=""
SECONDARY_CONFIG_FILE=""
if [ -n "$SECONDARY_HOME" ]; then
  SECONDARY_CONFIG_DIR="$SECONDARY_HOME/.gitnexus"
  SECONDARY_CONFIG_FILE="$SECONDARY_CONFIG_DIR/config.json"
fi

# ── Detect project name + package manager ──────────────────────────────
PROJECT_NAME="$(basename "$PWD")"
if [ -f "package.json" ]; then
  PROJECT_NAME=$(node -p "require('./package.json').name" 2>/dev/null || basename "$PWD")
fi

PKG_MANAGER="npm"
if [ -f "pnpm-lock.yaml" ]; then
  PKG_MANAGER="pnpm"
elif [ -f "yarn.lock" ]; then
  PKG_MANAGER="yarn"
fi

run_script() {
  case "$PKG_MANAGER" in
    pnpm) echo "pnpm $1" ;;
    yarn) echo "yarn $1" ;;
    *)    echo "npm run $1" ;;
  esac
}

echo ""
echo -e "${BLUE}🧠 GitNexus setup — ${PROJECT_NAME}${NC}"
echo -e "    runtime: ${RUNTIME_LABEL}"
echo -e "    config:  ${CONFIG_FILE}"
if [ -n "$SECONDARY_CONFIG_FILE" ]; then
  echo -e "    mirror:  ${SECONDARY_CONFIG_FILE}"
fi
echo ""

# ── Migrate any prior wrong-location key forward ───────────────────────
# Earlier versions of this script always wrote to $HOME, which under WSL
# meant /home/<user>/.gitnexus/config.json — invisible to Windows-native
# gitnexus. If we find a key there, copy it to the new primary location
# so the user doesn't have to paste it again.
write_config() {
  local target_dir="$1"
  local target_file="$2"
  local key="$3"
  mkdir -p "$target_dir"
  cat > "$target_file" <<EOF
{
  "apiKey": "$key",
  "provider": "openai"
}
EOF
  chmod 600 "$target_file" 2>/dev/null || true
}

extract_key() {
  # Pull "apiKey" value out of a config.json without needing jq or node.
  # Works for the shape this script writes (single-line string value, no
  # escaped quotes). If anything fancier is in the config, this returns
  # empty and we fall through to prompting the user. We deliberately
  # avoid `node -e` here because WSL bash often doesn't have node on its
  # PATH even when `npx` works (npx interop walks Windows PATH first).
  local file="$1"
  [ -f "$file" ] || return 0
  sed -nE 's/.*"apiKey"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$file" 2>/dev/null | head -n1
}

primary_has_key="no"
if [ -f "$CONFIG_FILE" ] && rg -q '"apiKey"' "$CONFIG_FILE" 2>/dev/null; then
  primary_has_key="yes"
fi

if [ -n "$SECONDARY_CONFIG_FILE" ] \
   && [ "$primary_has_key" = "no" ] \
   && [ -f "$SECONDARY_CONFIG_FILE" ]; then
  legacy_key="$(extract_key "$SECONDARY_CONFIG_FILE" || echo)"
  if [ -n "$legacy_key" ]; then
    echo -e "${BLUE}→${NC} Migrating existing key from ${SECONDARY_CONFIG_FILE} → ${CONFIG_FILE}"
    write_config "$CONFIG_DIR" "$CONFIG_FILE" "$legacy_key"
    echo -e "${GREEN}✓${NC} Migrated."
    echo ""
    primary_has_key="yes"
  fi
fi

# ── Step 1: detect existing key ────────────────────────────────────────
key_already_set="$primary_has_key"

if [ "$key_already_set" = "yes" ]; then
  echo -e "${GREEN}✓${NC} OpenAI key already configured at ${CONFIG_FILE}"
  # Make sure both homes are in sync on WSL so PowerShell and WSL bash
  # both see the same key going forward.
  if [ -n "$SECONDARY_CONFIG_FILE" ] && [ ! -f "$SECONDARY_CONFIG_FILE" ]; then
    existing_key="$(extract_key "$CONFIG_FILE" || echo)"
    if [ -n "$existing_key" ]; then
      echo -e "${BLUE}→${NC} Mirroring to ${SECONDARY_CONFIG_FILE}..."
      write_config "$SECONDARY_CONFIG_DIR" "$SECONDARY_CONFIG_FILE" "$existing_key"
      echo -e "${GREEN}✓${NC} Mirrored."
    fi
  fi
else
  echo -e "${YELLOW}!${NC} No GitNexus OpenAI key found."
  echo ""
  echo "  GitNexus needs an OpenAI key for two features:"
  echo "    • Semantic search (\`query\` tool) — uses text-embedding-3-small (~\$0.01 to bootstrap)"
  echo "    • Auto-generated wiki — uses gpt-4-class models (~\$1–5 per full regen)"
  echo ""
  echo "  The key will be saved to ${CONFIG_FILE} (per-developer, global)."
  if [ -n "$SECONDARY_CONFIG_FILE" ]; then
    echo "  A mirror copy will also be written to ${SECONDARY_CONFIG_FILE}"
    echo "  so both Windows-native and WSL-side \`gitnexus\` find it."
  fi
  echo "  It is NOT stored in the repo. NOT exported to env. Won't collide with your .zshrc."
  echo "  This key works for ALL your indexed gitnexus repos — set once, use everywhere."
  echo ""
  read -r -p "  Paste your OpenAI key (sk-...): " OPENAI_KEY
  echo ""

  if [ -z "$OPENAI_KEY" ]; then
    echo -e "${RED}✗ No key provided. Aborting.${NC}"
    exit 1
  fi

  if [[ ! "$OPENAI_KEY" =~ ^sk- ]]; then
    echo -e "${YELLOW}⚠ Key doesn't start with 'sk-' — continuing anyway, but double-check it's correct.${NC}"
  fi

  echo -e "${BLUE}→${NC} Saving key to ${CONFIG_FILE}..."
  write_config "$CONFIG_DIR" "$CONFIG_FILE" "$OPENAI_KEY"
  echo -e "${GREEN}✓${NC} Key saved (chmod 600)."

  if [ -n "$SECONDARY_CONFIG_FILE" ]; then
    echo -e "${BLUE}→${NC} Mirroring to ${SECONDARY_CONFIG_FILE}..."
    write_config "$SECONDARY_CONFIG_DIR" "$SECONDARY_CONFIG_FILE" "$OPENAI_KEY"
    echo -e "${GREEN}✓${NC} Mirrored."
  fi
fi

echo ""

# ── Step 2: full analyze with embeddings + skills ──────────────────────
echo -e "${BLUE}→${NC} Running full analyze with embeddings + skills (one-time, ~2–5 min)..."
echo ""

npx -y gitnexus analyze --force --embeddings --skills

echo ""
echo -e "${GREEN}✓ GitNexus setup complete for ${PROJECT_NAME}.${NC}"
echo ""
echo "  Daily commands you can now use:"
echo -e "    ${BLUE}$(run_script gitnexus:refresh)${NC}   — incremental refresh after pulling new code (fast)"
echo -e "    ${BLUE}$(run_script gitnexus:full)${NC}      — full force re-index (use after large refactors)"
echo -e "    ${BLUE}$(run_script gitnexus:wiki)${NC}      — regenerate the human-readable wiki (\$1–5 per run)"
echo -e "    ${BLUE}$(run_script gitnexus:status)${NC}    — show current index state"
echo ""
echo "  Skill files for agents are in:"
echo "    .claude/skills/generated/   (per-cluster, regenerated on every refresh)"
echo ""
