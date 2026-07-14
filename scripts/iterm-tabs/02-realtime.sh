#!/usr/bin/env bash
# BEVEL realtime (Colyseus) — https://realtime.bevel.lvh.me  (:43208)
set -euo pipefail

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

export REALTIME_PORT="${REALTIME_PORT:-43208}"
export REALTIME_URL="${REALTIME_URL:-https://realtime.bevel.lvh.me}"
export AUTH_SECRET="${AUTH_SECRET:-}"

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

free_port "$REALTIME_PORT"

echo "BEVEL realtime → https://realtime.bevel.lvh.me  (port $REALTIME_PORT)"
echo "  health:  https://realtime.bevel.lvh.me/health"
cd "$ROOT/services/realtime"
exec pnpm dev
