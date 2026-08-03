#!/usr/bin/env bash
# Sync @bevel/suite-chrome into a sibling 2x4m checkout (vendored workspace package).
# SOURCE OF TRUTH is always this bevel monorepo. Never edit the 2x4m copy as primary.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/packages/suite-chrome"
DEST_DEFAULT="$(cd "$ROOT/../2x4m" 2>/dev/null && pwd)/packages/suite-chrome"
DEST="${2X4M_SUITE_CHROME_DEST:-$DEST_DEFAULT}"

if [[ ! -d "$SRC" ]]; then
  echo "Missing source: $SRC" >&2
  exit 1
fi
if [[ ! -d "$(dirname "$DEST")" ]]; then
  echo "Missing 2x4m packages dir: $(dirname "$DEST")" >&2
  echo "Set 2X4M_SUITE_CHROME_DEST=/path/to/2x4m/packages/suite-chrome" >&2
  exit 1
fi

mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules \
  --exclude .turbo \
  --exclude dist \
  "$SRC/" "$DEST/"

# Stamp so agents know not to invent features in the copy
cat > "$DEST/UPSTREAM.md" <<EOF
# Upstream stamp

- **Source of truth:** \`derozic/bevel\` → \`packages/suite-chrome\`
- **Synced at:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **Do not develop Bevel dock features here.** PR to bevel, then re-run:

  \`\`\`bash
  cd ~/dev/bevel && ./scripts/sync-suite-chrome-to-2x4m.sh
  \`\`\`
EOF

echo "Synced @bevel/suite-chrome → $DEST"
echo "Next: in 2x4m, ensure package.json has \"@bevel/suite-chrome\": \"workspace:*\""
