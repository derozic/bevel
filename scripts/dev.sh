#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# shellcheck disable=SC1091
source .env 2>/dev/null || true

echo "Starting BEVEL stack (web, admin, realtime, domains)…"
echo "  Tenant app:  https://bevel.lvh.me"
echo "  Admin:       https://admin.bevel.lvh.me"
echo "  Realtime:    https://realtime.bevel.lvh.me"
echo "  Domains API: http://127.0.0.1:${DOMAINS_PORT:-43209}"

pnpm exec nx run-many -t dev \
  --projects=web,admin,realtime,domains \
  --parallel=4