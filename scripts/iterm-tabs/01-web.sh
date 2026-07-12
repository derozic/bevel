#!/usr/bin/env bash
# BEVEL web (Next.js) — https://bevel.lvh.me  (:43200)
set -euo pipefail

# Ensure nvm / local tooling when opened as a bare iTerm tab
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
fi
export PATH="${HOME}/.local/share/pnpm:/opt/homebrew/bin:${PATH}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
set -a
source "$ROOT/.env" 2>/dev/null || true
set +a

export BEVEL_TENANTS_ROOT="${BEVEL_TENANTS_ROOT:-$ROOT/tenants}"
export NODE_OPTIONS="${NODE_OPTIONS:---dns-result-order=ipv4first}"
export WATCHPACK_POLLING="${WATCHPACK_POLLING:-true}"
export NEXT_TELEMETRY_DISABLED=1
export WEB_PORT="${WEB_PORT:-43200}"
export REALTIME_SERVER_URL="${REALTIME_SERVER_URL:-http://127.0.0.1:${REALTIME_PORT:-43208}}"
export NEXT_PUBLIC_REALTIME_URL="${NEXT_PUBLIC_REALTIME_URL:-https://realtime.bevel.lvh.me}"

free_port() {
  local port="$1"
  local tries=0
  local pids

  while pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    if [[ -z "$pids" ]]; then
      break
    fi
    echo "Freeing :$port (pids: $pids)"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.4
    # still held?
    if pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); then
      if [[ -n "$pids" ]]; then
        # shellcheck disable=SC2086
        kill -9 $pids 2>/dev/null || true
      fi
    fi
    tries=$((tries + 1))
    if (( tries >= 15 )); then
      echo "ERROR: could not free port $port" >&2
      lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
      exit 1
    fi
    sleep 0.3
  done
}

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not on PATH. Install with: npm install -g pnpm" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not on PATH (open an interactive shell or install nvm)." >&2
  exit 1
fi

free_port "$WEB_PORT"

echo "BEVEL web → https://bevel.lvh.me  (port $WEB_PORT)"
echo "  org:     https://bevel.2x4m.lvh.me"
echo "  node:    $(node --version)  pnpm: $(pnpm --version)"
cd "$ROOT/apps/web"
exec pnpm dev
