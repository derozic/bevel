#!/usr/bin/env bash
# BEVEL control API (FastAPI + GraphQL + MCP) — https://api.bevel.lvh.me  (:43203)
set -euo pipefail

export PATH="/opt/homebrew/bin:${HOME}/.local/bin:${PATH}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
set -a
source "$ROOT/.env" 2>/dev/null || true
set +a
export API_PORT="${API_PORT:-43203}"
export BEVEL_TENANTS_ROOT="${BEVEL_TENANTS_ROOT:-$ROOT/tenants}"
export REALTIME_SERVER_URL="${REALTIME_SERVER_URL:-http://127.0.0.1:${REALTIME_PORT:-43208}}"

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

if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv not on PATH" >&2
  exit 1
fi

free_port "$API_PORT"

echo "BEVEL API → https://api.bevel.lvh.me  (port $API_PORT)"
echo "  docs:     https://api.bevel.lvh.me/docs"
echo "  graphql:  https://api.bevel.lvh.me/graphql"
cd "$ROOT/services/api"
exec uv run uvicorn bevel_api.main:app --host 127.0.0.1 --port "$API_PORT" --reload
