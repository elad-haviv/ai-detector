#!/usr/bin/env bash
# Installs penprint-docx globally (~/.claude/skills) as a self-contained copy.
# Re-run after changing src/lib (heuristics, prompts, patterns) to refresh the vendored copy.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SKILL/../../.." && pwd)"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/penprint-docx"
rm -rf "$DEST"; mkdir -p "$DEST/vendor/lib/patterns" "$DEST/vendor/lib/i18n"
cp -r "$SKILL/SKILL.md" "$SKILL/scripts" "$DEST/"
L="$REPO/src/lib"
cp "$L/heuristics.ts" "$L/segment.ts" "$L/prompts.ts" "$DEST/vendor/lib/"
cp "$L/patterns/catalog.ts" "$L/patterns/catalog.en.ts" "$DEST/vendor/lib/patterns/"
cp "$L/i18n/he.ts" "$L/i18n/en.ts" "$DEST/vendor/lib/i18n/"
cp "$L/types.ts" "$DEST/vendor/lib/"
echo "installed to $DEST"
