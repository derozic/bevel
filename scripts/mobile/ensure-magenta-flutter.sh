#!/usr/bin/env bash
# Resolve magenta_flutter for apps/mobile/pubspec.yaml
# (path: ../../../magenta-mono/packages/magenta_flutter).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SIBLING="$(cd "$ROOT/.." && pwd)/magenta-mono"
PKG="$SIBLING/packages/magenta_flutter"

if [[ -f "$PKG/pubspec.yaml" ]]; then
  echo "magenta_flutter ready at $PKG"
  exit 0
fi

TOKEN="${GH_PAT:-${GITHUB_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "magenta-mono is not at $SIBLING and GH_PAT/GITHUB_TOKEN is unset." >&2
  echo "Clone https://github.com/derozic/magenta-mono next to this repo, or set GH_PAT." >&2
  exit 1
fi

mkdir -p "$(dirname "$SIBLING")"
echo "Cloning derozic/magenta-mono -> $SIBLING"
git clone --depth 1 "https://x-access-token:${TOKEN}@github.com/derozic/magenta-mono.git" "$SIBLING"

if [[ ! -f "$PKG/pubspec.yaml" ]]; then
  echo "Clone succeeded but $PKG/pubspec.yaml is missing." >&2
  exit 1
fi
echo "magenta_flutter ready at $PKG"
