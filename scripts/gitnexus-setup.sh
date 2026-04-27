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

CONFIG_DIR="$HOME/.gitnexus"
CONFIG_FILE="$CONFIG_DIR/config.json"

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
echo ""

# ── Step 1: detect existing key ────────────────────────────────────────
key_already_set="no"
if [ -f "$CONFIG_FILE" ] && rg -q '"apiKey"' "$CONFIG_FILE" 2>/dev/null; then
  key_already_set="yes"
fi

if [ "$key_already_set" = "yes" ]; then
  echo -e "${GREEN}✓${NC} OpenAI key already configured at ${CONFIG_FILE}"
else
  echo -e "${YELLOW}!${NC} No GitNexus OpenAI key found."
  echo ""
  echo "  GitNexus needs an OpenAI key for two features:"
  echo "    • Semantic search (\`query\` tool) — uses text-embedding-3-small (~\$0.01 to bootstrap)"
  echo "    • Auto-generated wiki — uses gpt-4-class models (~\$1–5 per full regen)"
  echo ""
  echo "  The key will be saved to ${CONFIG_FILE} (per-developer, global)."
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

  # Direct write is the simplest reliable path. We previously tried piping
  # through `gitnexus wiki --api-key … --review` first, but that didn't always
  # persist the key before exit and produced scary-but-harmless warnings.
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_FILE" <<EOF
{
  "apiKey": "$OPENAI_KEY",
  "provider": "openai"
}
EOF
  chmod 600 "$CONFIG_FILE"
  echo -e "${GREEN}✓${NC} Key saved (chmod 600)."
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
