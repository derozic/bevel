#!/usr/bin/env bash
# JOHNNY (or any agent program) → BEVEL channel message + notification payload.
# Usage:
#   ./scripts/johnny-bevel-notify.sh "Caddy healed" "Reloaded global config" warning
# Env:
#   BEVEL_PROGRAM_URL   default https://bevel.2x4m.lvh.me/api/agent-programs/events
#   FLEET_INTERNAL_API_KEY  optional shared secret

set -euo pipefail

TITLE="${1:-JOHNNY: program update}"
BODY="${2:-Agent program completed.}"
SEVERITY="${3:-info}"
CHANNEL="${BEVEL_CHANNEL_SLUG:-general}"
AGENT_ID="${BEVEL_AGENT_ID:-johnny}"
PROGRAM_ID="${BEVEL_PROGRAM_ID:-johnny-ops}"
URL="${BEVEL_PROGRAM_URL:-https://bevel.2x4m.lvh.me/api/agent-programs/events}"

HEADERS=(-H "Content-Type: application/json")
if [[ -n "${FLEET_INTERNAL_API_KEY:-}" ]]; then
  HEADERS+=(-H "X-Fleet-Internal-Key: ${FLEET_INTERNAL_API_KEY}")
fi

curl -sk -X POST "$URL" \
  "${HEADERS[@]}" \
  -d "$(python3 - <<PY
import json
print(json.dumps({
  "agentId": """$AGENT_ID""",
  "programId": """$PROGRAM_ID""",
  "title": """$TITLE""",
  "body": """$BODY""",
  "severity": """$SEVERITY""",
  "channelSlug": """$CHANNEL""",
}))
PY
)"
echo
