#!/usr/bin/env bash
# BEVEL admin — https://admin.bevel.lvh.me  (:43201)
set -euo pipefail

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
fi
export PATH="${HOME}/.local/share/pnpm:/opt/homebrew/bin:${PATH}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
set -a
source "$ROOT/.env" 2>/dev/null || true
set +a
export ADMIN_PORT="${ADMIN_PORT:-43201}"
export BEVEL_TENANTS_ROOT="${BEVEL_TENANTS_ROOT:-$ROOT/tenants}"
export NODE_OPTIONS="${NODE_OPTIONS:---dns-result-order=ipv4first}"
export NEXT_TELEMETRY_DISABLED=1

free_port() {
  local port="$1"
  local tries=0
  local pids
  while pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); do
    if [[ -z "$pids" ]]; then break; fi
    echo "Freeing :$port (pids: $pids)"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.4
    if pids=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null); then
      if [[ -n "$pids" ]]; then
        # shellcheck disable=SC2086
        kill -9 $pids 2>/dev/null || true
      fi
    fi
    tries=$((tries + 1))
    if (( tries >= 15 )); then
      echo "ERROR: could not free port $port" >&2
      exit 1
    fi
    sleep 0.3
  done
}

free_port "$ADMIN_PORT"

echo "BEVEL admin → https://admin.bevel.lvh.me  (port $ADMIN_PORT)"
cd "$ROOT/apps/admin"
exec pnpm dev
