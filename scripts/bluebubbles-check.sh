#!/usr/bin/env bash
# Verify local BlueBubbles API for BEVEL iMessage bridge.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Load monorepo .env if present (do not print secrets)
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

URL="${BLUEBUBBLES_URL:-http://127.0.0.1:1234}"
URL="${URL%/}"
PASS="${BLUEBUBBLES_PASSWORD:-}"

CFG_DB="${HOME}/Library/Application Support/bluebubbles-server/config.db"

echo "==> BlueBubbles check"
echo "    URL: $URL"

if pgrep -x BlueBubbles >/dev/null 2>&1; then
  echo "    process: running"
else
  echo "    process: NOT RUNNING — open -a BlueBubbles"
  open -a BlueBubbles 2>/dev/null || true
fi

echo -n "    listen: "
LISTEN_OK=0
while read -r pid; do
  # Only TCP LISTEN rows for this PID (NAME is last field, e.g. *:1234)
  ports=$(lsof -nP -a -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null \
    | awk 'NR>1 {print $NF}' | sort -u | tr '\n' ' ')
  if [[ -n "${ports// /}" ]]; then
    echo "$ports"
    LISTEN_OK=1
  fi
done < <(pgrep -x BlueBubbles || true)
if [[ "$LISTEN_OK" -eq 0 ]]; then
  echo "(none — start server in BlueBubbles UI)"
fi

# Detect password saved in BlueBubbles (status only — never print value)
PASS_STATUS="unknown"
if [[ -f "$CFG_DB" ]] && command -v sqlite3 >/dev/null 2>&1; then
  PASS_STATUS=$(sqlite3 "$CFG_DB" \
    "SELECT CASE WHEN value IS NULL OR value='' THEN 'EMPTY' ELSE 'SET' END FROM config WHERE name='password';" 2>/dev/null || echo unknown)
fi
echo "    server password in BlueBubbles DB: $PASS_STATUS"
if [[ -n "$PASS" ]]; then
  echo "    BLUEBUBBLES_PASSWORD in env: SET"
else
  echo "    BLUEBUBBLES_PASSWORD in env: missing"
fi

ping_url="$URL/api/v1/ping"
if [[ -n "$PASS" ]]; then
  ping_url="${ping_url}?password=$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['BLUEBUBBLES_PASSWORD']))" 2>/dev/null || echo "$PASS")"
fi

echo -n "    GET /api/v1/ping … "
code=$(curl -sS -o /tmp/bb-ping.json -w '%{http_code}' --connect-timeout 3 \
  ${PASS:+-H "Authorization: Bearer $PASS"} \
  "$ping_url" 2>/dev/null || echo fail)
echo "$code"
if [[ -f /tmp/bb-ping.json ]]; then head -c 240 /tmp/bb-ping.json; echo; fi

if [[ "$code" == "200" ]]; then
  echo ""
  echo "    OK — BlueBubbles API authorized."
  echo "    Hermes URL answer:  $URL"
  echo "    Password:           use same value as BLUEBUBBLES_PASSWORD / OpenClaw config"
  exit 0
fi

if [[ "$code" == "401" || "$code" == "500" ]]; then
  echo ""
  echo "    API is reachable, but password is not configured correctly."
  if [[ "$PASS_STATUS" == "EMPTY" ]]; then
    echo ""
    echo "    FIX (required): set password INSIDE BlueBubbles first"
    echo "      1. Open BlueBubbles"
    echo "      2. Connection / Settings → API password field"
    echo "      3. Enter a strong password"
    echo "      4. Click the SAVE (floppy) icon — must not stay empty"
    echo "      5. Confirm: sqlite status becomes SET after save"
  fi
  if [[ -z "$PASS" ]]; then
    echo ""
    echo "    Then set Bevel env (never commit):"
    echo "      # $ROOT/.env"
    echo "      BLUEBUBBLES_URL=$URL"
    echo "      BLUEBUBBLES_PASSWORD='your-password'"
    echo "      # 1Password item: BEVEL BlueBubbles API"
  fi
  echo ""
  echo "    Re-run: ./scripts/bluebubbles-check.sh"
  echo "    Hermes URL answer (even before password in env): $URL"
  exit 2
fi

echo ""
echo "API not reachable. Next steps:"
echo "  1. open -a BlueBubbles"
echo "  2. Full Disk Access for BlueBubbles"
echo "  3. Finish setup → password saved → server on :1234"
exit 1
