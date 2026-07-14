#!/usr/bin/env bash
# BEVEL local stack — start / stop / status / monitor
# Ports: web 43200 · admin 43201 · api 43203 · realtime 43208 · domains 43209
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
set -a
[[ -f "$ROOT/.env" ]] && source "$ROOT/.env"
set +a

export BEVEL_TENANTS_ROOT="${BEVEL_TENANTS_ROOT:-$ROOT/tenants}"
export WEB_PORT="${WEB_PORT:-43200}"
export ADMIN_PORT="${ADMIN_PORT:-43201}"
export API_PORT="${API_PORT:-43203}"
export REALTIME_PORT="${REALTIME_PORT:-43208}"
export DOMAINS_PORT="${DOMAINS_PORT:-43209}"
export REALTIME_SERVER_URL="${REALTIME_SERVER_URL:-http://127.0.0.1:${REALTIME_PORT}}"
export NEXT_PUBLIC_REALTIME_URL="${NEXT_PUBLIC_REALTIME_URL:-https://realtime.bevel.lvh.me}"
export NODE_OPTIONS="${NODE_OPTIONS:---dns-result-order=ipv4first}"
export WATCHPACK_POLLING="${WATCHPACK_POLLING:-true}"
export NEXT_TELEMETRY_DISABLED=1

PID_DIR="${BEVEL_PID_DIR:-$ROOT/.run}"
LOG_DIR="${BEVEL_LOG_DIR:-$ROOT/logs}"
mkdir -p "$PID_DIR" "$LOG_DIR"

# name|label|port|health_path|start_cwd|start_cmd
SERVICES=(
  "api|Control API|${API_PORT}|/health|services/api|uv run uvicorn bevel_api.main:app --host 127.0.0.1 --port ${API_PORT} --reload"
  "web|Web|${WEB_PORT}|/|apps/web|pnpm dev"
  "admin|Admin|${ADMIN_PORT}|/|apps/admin|pnpm dev"
  "realtime|Realtime|${REALTIME_PORT}|/health|services/realtime|pnpm dev"
)

START_ORDER=(api realtime web admin)
STOP_ORDER=(admin web realtime api)

usage() {
  cat <<'EOF'
BEVEL service control

Usage:
  scripts/services.sh start   [all|api|web|admin|realtime|...]
  scripts/services.sh stop    [all|api|web|admin|realtime|...]
  scripts/services.sh status
  scripts/services.sh monitor [--interval 2]
  scripts/services.sh urls

Tab launchers (one process per terminal):
  bash scripts/iterm-tabs/00-api.sh
  bash scripts/iterm-tabs/01-web.sh
  bash scripts/iterm-tabs/02-realtime.sh
  bash scripts/iterm-tabs/03-admin.sh

URLs (via Caddy — one global instance):
  https://bevel.lvh.me
  https://api.bevel.lvh.me
  https://admin.bevel.lvh.me
  https://realtime.bevel.lvh.me/health
EOF
}

_port_open() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

_pid_alive() {
  [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null
}

_read_pid() {
  local f="$PID_DIR/$1.pid"
  [[ -f "$f" ]] || { echo ""; return; }
  tr -d ' \n' <"$f" || true
}

_write_pid() {
  echo "$2" >"$PID_DIR/$1.pid"
}

_clear_pid() {
  rm -f "$PID_DIR/$1.pid"
}

_service_row() {
  local name="$1"
  for row in "${SERVICES[@]}"; do
    IFS='|' read -r n label port health cwd cmd <<<"$row"
    if [[ "$n" == "$name" ]]; then
      echo "$row"
      return 0
    fi
  done
  return 1
}

_http_ok() {
  local port="$1" path="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 1.5 "http://127.0.0.1:${port}${path}" 2>/dev/null || echo 000)
  [[ "$code" =~ ^[23] ]]
}

_start_one() {
  local name="$1"
  local row
  row=$(_service_row "$name") || { echo "unknown service: $name"; return 1; }
  IFS='|' read -r n label port health cwd cmd <<<"$row"

  if _port_open "$port" && _http_ok "$port" "$health"; then
    echo "  [ok] $label already up :$port"
    return 0
  fi

  if _port_open "$port"; then
    echo "  reclaiming :$port"
    kill $(lsof -t -iTCP:"$port" -sTCP:LISTEN) 2>/dev/null || true
    sleep 1
  fi

  echo "  starting $label → :$port"
  (
    cd "$ROOT/$cwd"
    # shellcheck disable=SC2086
    nohup bash -lc "$cmd" >>"$LOG_DIR/$name.log" 2>&1 &
    echo $! >"$PID_DIR/$name.pid"
  )
  # wait for health
  local i=0
  while (( i < 40 )); do
    if _http_ok "$port" "$health"; then
      echo "  [up] $label"
      return 0
    fi
    sleep 0.5
    ((i++)) || true
  done
  echo "  [warn] $label started but health not ready yet (see logs/$name.log)"
}

_stop_one() {
  local name="$1"
  local row
  row=$(_service_row "$name") || { echo "unknown service: $name"; return 1; }
  IFS='|' read -r n label port health cwd cmd <<<"$row"

  local pid
  pid=$(_read_pid "$name")
  if _pid_alive "$pid"; then
    echo "  stopping $label (pid $pid)"
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    kill -9 "$pid" 2>/dev/null || true
  fi
  if _port_open "$port"; then
    echo "  freeing :$port"
    kill $(lsof -t -iTCP:"$port" -sTCP:LISTEN) 2>/dev/null || true
  fi
  _clear_pid "$name"
  echo "  [down] $label"
}

cmd_status() {
  printf "%-12s %-8s %-8s %-8s %s\n" "SERVICE" "PORT" "PROCESS" "HTTP" "URL"
  for row in "${SERVICES[@]}"; do
    IFS='|' read -r n label port health cwd cmd <<<"$row"
    local proc="down" http="down"
    if _port_open "$port"; then proc="up"; fi
    if _http_ok "$port" "$health"; then http="up"; fi
    local url="http://127.0.0.1:${port}${health}"
    printf "%-12s %-8s %-8s %-8s %s\n" "$n" "$port" "$proc" "$http" "$url"
  done
  echo
  echo "Public (Caddy):"
  echo "  https://bevel.lvh.me"
  echo "  https://api.bevel.lvh.me"
  echo "  https://admin.bevel.lvh.me"
  echo "  https://realtime.bevel.lvh.me/health"
}

cmd_start() {
  local targets=("${@:-}")
  if [[ ${#targets[@]} -eq 0 || "${targets[0]}" == "all" ]]; then
    targets=("${START_ORDER[@]}")
  fi
  echo "Starting BEVEL: ${targets[*]}"
  for t in "${targets[@]}"; do
    _start_one "$t" || true
  done
  cmd_status
}

cmd_stop() {
  local targets=("${@:-}")
  if [[ ${#targets[@]} -eq 0 || "${targets[0]}" == "all" ]]; then
    targets=("${STOP_ORDER[@]}")
  fi
  echo "Stopping BEVEL: ${targets[*]}"
  for t in "${targets[@]}"; do
    _stop_one "$t" || true
  done
  cmd_status
}

cmd_monitor() {
  local interval=2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --interval|-i) interval="${2:-2}"; shift 2 ;;
      *) shift ;;
    esac
  done
  echo "Monitoring BEVEL every ${interval}s — Ctrl+C to stop"
  while true; do
    clear 2>/dev/null || true
    date
    cmd_status
    sleep "$interval"
  done
}

cmd_urls() {
  cat <<EOF
https://bevel.lvh.me
https://bevel.2x4m.lvh.me
https://bevel.lvh.me/login
https://api.bevel.lvh.me/health
https://api.bevel.lvh.me/docs
https://api.bevel.lvh.me/graphql
https://admin.bevel.lvh.me
https://realtime.bevel.lvh.me/health
EOF
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    start) cmd_start "$@" ;;
    stop) cmd_stop "$@" ;;
    status) cmd_status ;;
    monitor) cmd_monitor "$@" ;;
    urls) cmd_urls ;;
    help|--help|-h|"") usage ;;
    *) echo "Unknown: $cmd"; usage; exit 1 ;;
  esac
}

main "$@"
