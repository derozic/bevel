#!/usr/bin/env bash
# Configure local + production env for Slack + BlueBubbles so we can validate.
#
# Usage:
#   # BlueBubbles only (reads password from local BlueBubbles config.db):
#   ./scripts/setup-integrations-env.sh bluebubbles
#
#   # Slack (requires credentials — never commit them):
#   SLACK_CLIENT_ID=… SLACK_CLIENT_SECRET=… SLACK_SIGNING_SECRET=… \
#     SLACK_APP_ID=A… ./scripts/setup-integrations-env.sh slack
#
#   # Both, then smoke checks:
#   ./scripts/setup-integrations-env.sh all
#   ./scripts/setup-integrations-env.sh validate
#
#   # Apply Slack creds from 1Password item "BEVEL Slack App" (dev vault):
#   ./scripts/setup-integrations-env.sh slack-from-1p
#
#   # Write Slack to production EC2 only (after local ok):
#   ./scripts/setup-integrations-env.sh prod-slack
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SSH_HOST="${BEVEL_DEPLOY_HOST:-bevel-prod}"
OP_VAULT="${BEVEL_OP_VAULT:-dev}"
OP_SLACK_ITEM="${BEVEL_OP_SLACK_ITEM:-BEVEL Slack App}"
OP_BB_ITEM="${BEVEL_OP_BB_ITEM:-BEVEL BlueBubbles API}"
BB_DB="${HOME}/Library/Application Support/bluebubbles-server/config.db"

log() { printf '==> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

ensure_secrets_dirs() {
  mkdir -p "$ROOT/data/secrets/slack"
  chmod 700 "$ROOT/data/secrets" "$ROOT/data/secrets/slack" 2>/dev/null || true
}

# Upsert KEY=value in a dotenv file without printing the value.
dotenv_set() {
  local file="$1" key="$2" value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
import pathlib, re, sys
path, key, value = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
text = path.read_text() if path.exists() else ""
# Prefer double-quoted values so # and spaces are safe
escaped = value.replace("\\", "\\\\").replace('"', '\\"')
line = f'{key}="{escaped}"'
pat = re.compile(rf'^[ \t]*#?[ \t]*{re.escape(key)}=.*$', re.M)
if pat.search(text):
    text = pat.sub(line, text, count=1)
else:
    if text and not text.endswith("\n"):
        text += "\n"
    text += line + "\n"
path.write_text(text)
path.chmod(0o600)
print(f"set {key} in {path} (len={len(value)})")
PY
}

sync_bluebubbles_from_db() {
  log "BlueBubbles: sync password from config.db → .env"
  [[ -f "$BB_DB" ]] || die "BlueBubbles config.db not found at $BB_DB — open -a BlueBubbles and set API password"
  command -v sqlite3 >/dev/null || die "sqlite3 required"
  local pw
  pw="$(sqlite3 "$BB_DB" "SELECT value FROM config WHERE name='password';")"
  [[ -n "$pw" ]] || die "BlueBubbles password empty — set it in BlueBubbles → Settings → API"
  dotenv_set "$ROOT/.env" BLUEBUBBLES_URL "http://127.0.0.1:1234"
  dotenv_set "$ROOT/.env" BLUEBUBBLES_PASSWORD "$pw"
  # Optional 1Password mirror
  if command -v op >/dev/null 2>&1; then
    if op item get "$OP_BB_ITEM" --vault="$OP_VAULT" >/dev/null 2>&1; then
      op item edit "$OP_BB_ITEM" --vault="$OP_VAULT" "password=$pw" >/dev/null \
        && log "1Password: updated $OP_BB_ITEM" || warn "1Password edit failed"
    else
      op item create --category=login --title="$OP_BB_ITEM" --vault="$OP_VAULT" \
        "username=bluebubbles" "password=$pw" "url=http://127.0.0.1:1234" \
        --tags bevel,imessage \
        "notesPlain=Local Mac BlueBubbles API for BEVEL iMessage. See docs/BLUEBUBBLES_IMESSAGE.md." \
        >/dev/null && log "1Password: created $OP_BB_ITEM" || warn "1Password create failed"
    fi
  fi
  # Smoke
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
  local code
  code="$(
    curl -sS -o /tmp/bb-ping.json -w '%{http_code}' --connect-timeout 3 \
      -H "Authorization: Bearer ${BLUEBUBBLES_PASSWORD}" \
      "${BLUEBUBBLES_URL%/}/api/v1/ping?password=$(python3 -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["BLUEBUBBLES_PASSWORD"]))')" \
      2>/dev/null || echo fail
  )"
  if [[ "$code" == "200" ]]; then
    log "BlueBubbles ping OK (200)"
  else
    die "BlueBubbles ping failed ($code) — run ./scripts/bluebubbles-check.sh"
  fi
}

require_slack_env() {
  [[ -n "${SLACK_CLIENT_ID:-}" ]] || die "SLACK_CLIENT_ID required"
  [[ -n "${SLACK_CLIENT_SECRET:-}" ]] || die "SLACK_CLIENT_SECRET required"
  [[ -n "${SLACK_SIGNING_SECRET:-}" ]] || die "SLACK_SIGNING_SECRET required"
}

write_slack_local() {
  require_slack_env
  log "Slack: write local .env"
  dotenv_set "$ROOT/.env" SLACK_CLIENT_ID "$SLACK_CLIENT_ID"
  dotenv_set "$ROOT/.env" SLACK_CLIENT_SECRET "$SLACK_CLIENT_SECRET"
  dotenv_set "$ROOT/.env" SLACK_SIGNING_SECRET "$SLACK_SIGNING_SECRET"
  dotenv_set "$ROOT/.env" SLACK_REDIRECT_URI \
    "${SLACK_REDIRECT_URI_LOCAL:-https://bevel.lvh.me/api/integrations/slack/oauth/callback}"
  if [[ -n "${SLACK_APP_ID:-}" ]]; then
    dotenv_set "$ROOT/.env" SLACK_APP_ID "$SLACK_APP_ID"
  fi
  # apps/web inherits process env from services.sh; also write .env.local for next dev direct starts
  ensure_secrets_dirs
  for key in SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_SIGNING_SECRET SLACK_REDIRECT_URI SLACK_APP_ID; do
    if [[ -n "${!key:-}" ]]; then
      dotenv_set "$ROOT/apps/web/.env.local" "$key" "${!key}"
    fi
  done
  # Local redirect override for web
  dotenv_set "$ROOT/apps/web/.env.local" SLACK_REDIRECT_URI \
    "${SLACK_REDIRECT_URI_LOCAL:-https://bevel.lvh.me/api/integrations/slack/oauth/callback}"
  dotenv_set "$ROOT/apps/web/.env.local" BLUEBUBBLES_URL "${BLUEBUBBLES_URL:-http://127.0.0.1:1234}"
  if [[ -n "${BLUEBUBBLES_PASSWORD:-}" ]]; then
    dotenv_set "$ROOT/apps/web/.env.local" BLUEBUBBLES_PASSWORD "$BLUEBUBBLES_PASSWORD"
  elif [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
    [[ -n "${BLUEBUBBLES_PASSWORD:-}" ]] && dotenv_set "$ROOT/apps/web/.env.local" BLUEBUBBLES_PASSWORD "$BLUEBUBBLES_PASSWORD"
    [[ -n "${BLUEBUBBLES_URL:-}" ]] && dotenv_set "$ROOT/apps/web/.env.local" BLUEBUBBLES_URL "$BLUEBUBBLES_URL"
  fi
  chmod 600 "$ROOT/apps/web/.env.local" 2>/dev/null || true

  if command -v op >/dev/null 2>&1; then
    if op item get "$OP_SLACK_ITEM" --vault="$OP_VAULT" >/dev/null 2>&1; then
      op item edit "$OP_SLACK_ITEM" --vault="$OP_VAULT" \
        "client id[text]=$SLACK_CLIENT_ID" \
        "client secret[concealed]=$SLACK_CLIENT_SECRET" \
        "signing secret[concealed]=$SLACK_SIGNING_SECRET" \
        ${SLACK_APP_ID:+"app id[text]=$SLACK_APP_ID"} \
        >/dev/null && log "1Password: updated $OP_SLACK_ITEM" || warn "1Password edit failed"
    else
      op item create --category=login --title="$OP_SLACK_ITEM" --vault="$OP_VAULT" \
        "username=${SLACK_APP_ID:-bevel-slack}" \
        "password=$SLACK_CLIENT_SECRET" \
        "client id[text]=$SLACK_CLIENT_ID" \
        "client secret[concealed]=$SLACK_CLIENT_SECRET" \
        "signing secret[concealed]=$SLACK_SIGNING_SECRET" \
        ${SLACK_APP_ID:+"app id[text]=$SLACK_APP_ID"} \
        "url=https://api.slack.com/apps" \
        --tags bevel,slack \
        "notesPlain=BEVEL Slack app. Redirects: https://bevel.is/api/integrations/slack/oauth/callback and https://bevel.lvh.me/api/integrations/slack/oauth/callback. Enable Token Rotation. Events: https://bevel.is/api/integrations/slack/events. See docs/SLACK_INTEGRATION.md." \
        >/dev/null && log "1Password: created $OP_SLACK_ITEM" || warn "1Password create failed"
    fi
  fi
}

write_slack_prod() {
  require_slack_env
  log "Slack: write production apps/web/.env.production + ensure secrets dir"
  local prod_redirect="${SLACK_REDIRECT_URI_PROD:-https://bevel.is/api/integrations/slack/oauth/callback}"
  export SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_SIGNING_SECRET SLACK_APP_ID
  export SLACK_REDIRECT_URI_PROD="$prod_redirect"
  local payload b64
  payload="$(
    python3 - <<'INNER'
import json, os
print(json.dumps({
  "SLACK_CLIENT_ID": os.environ["SLACK_CLIENT_ID"],
  "SLACK_CLIENT_SECRET": os.environ["SLACK_CLIENT_SECRET"],
  "SLACK_SIGNING_SECRET": os.environ["SLACK_SIGNING_SECRET"],
  "SLACK_REDIRECT_URI": os.environ.get(
    "SLACK_REDIRECT_URI_PROD",
    "https://bevel.is/api/integrations/slack/oauth/callback",
  ),
  "SLACK_APP_ID": os.environ.get("SLACK_APP_ID") or "",
  "BEVEL_PUBLIC_URL": "https://bevel.is",
}))
INNER
  )"
  b64="$(printf '%s' "$payload" | base64 | tr -d '\n')"
  ssh -o ConnectTimeout=20 "$SSH_HOST" "sudo B64='$b64' bash -s" <<'REMOTE'
set -euo pipefail
ENVF=/opt/bevel/apps/web/.env.production
test -f "$ENVF" || { echo "missing $ENVF"; exit 1; }
python3 - <<'PY'
import base64, json, os, pathlib, re
pairs = json.loads(base64.b64decode(os.environ["B64"]).decode())
pairs = {k: v for k, v in pairs.items() if v}
path = pathlib.Path("/opt/bevel/apps/web/.env.production")
text = path.read_text()
for key, value in pairs.items():
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    line = f'{key}="{escaped}"'
    pat = re.compile(rf"^[ \t]*#?[ \t]*{re.escape(key)}=.*$", re.M)
    if pat.search(text):
        text = pat.sub(line, text, count=1)
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += line + "\n"
path.write_text(text)
path.chmod(0o600)
print("updated", path, "keys:", ", ".join(sorted(pairs)))
PY
mkdir -p /opt/bevel/data/secrets/slack
chown -R deploy:deploy /opt/bevel/data
chmod 700 /opt/bevel/data/secrets /opt/bevel/data/secrets/slack
systemctl restart 2x4m-bevel
sleep 2
systemctl is-active 2x4m-bevel
REMOTE
  log "Production web restarted with Slack env"
}

load_slack_from_1p() {
  command -v op >/dev/null || die "1Password CLI (op) required"
  log "Slack: load from 1Password item $OP_SLACK_ITEM ($OP_VAULT)"
  SLACK_CLIENT_ID="$(op item get "$OP_SLACK_ITEM" --vault="$OP_VAULT" --fields "client id" --reveal 2>/dev/null || true)"
  SLACK_CLIENT_SECRET="$(op item get "$OP_SLACK_ITEM" --vault="$OP_VAULT" --fields "client secret" --reveal 2>/dev/null || true)"
  SLACK_SIGNING_SECRET="$(op item get "$OP_SLACK_ITEM" --vault="$OP_VAULT" --fields "signing secret" --reveal 2>/dev/null || true)"
  SLACK_APP_ID="$(op item get "$OP_SLACK_ITEM" --vault="$OP_VAULT" --fields "app id" --reveal 2>/dev/null || true)"
  export SLACK_CLIENT_ID SLACK_CLIENT_SECRET SLACK_SIGNING_SECRET SLACK_APP_ID
  require_slack_env
}

validate_local() {
  log "Validate local"
  bash "$ROOT/scripts/bluebubbles-check.sh" || true
  curl -sS -o /dev/null -w "local health %{http_code}\n" https://bevel.lvh.me/api/health || true
  curl -sS -o /dev/null -w "local slack mcp %{http_code}\n" https://bevel.lvh.me/api/integrations/slack/mcp || true
  # url_verification without signing secret still works
  local ch="validate-$(date +%s)"
  local body
  body="$(curl -sS -X POST https://bevel.lvh.me/api/integrations/slack/events \
    -H 'Content-Type: application/json' \
    -d "{\"type\":\"url_verification\",\"challenge\":\"$ch\"}" || true)"
  echo "local events challenge: $body"
  # oauth start should 401 unauth or 503 if not configured
  curl -sS -o /tmp/slack-start.json -w "local oauth start %{http_code}\n" \
    https://bevel.lvh.me/api/integrations/slack/oauth/start || true
  head -c 200 /tmp/slack-start.json 2>/dev/null; echo
  if rg -q '^SLACK_CLIENT_ID=.+' "$ROOT/.env" 2>/dev/null || rg -q '^SLACK_CLIENT_ID=.+' "$ROOT/apps/web/.env.local" 2>/dev/null; then
    log "Slack client id present in env files"
  else
    warn "Slack not configured locally yet"
  fi
}

validate_prod() {
  log "Validate production"
  curl -sS -o /dev/null -w "prod login %{http_code}\n" https://bevel.is/login || true
  curl -sS -o /dev/null -w "prod slack mcp %{http_code}\n" https://bevel.is/api/integrations/slack/mcp || true
  curl -sS -o /dev/null -w "prod slack status (anon) %{http_code}\n" https://bevel.is/api/integrations/slack/status || true
  local ch="prod-validate-$(date +%s)"
  local body
  body="$(curl -sS -X POST https://bevel.is/api/integrations/slack/events \
    -H 'Content-Type: application/json' \
    -d "{\"type\":\"url_verification\",\"challenge\":\"$ch\"}" || true)"
  echo "prod events challenge: $body"
  curl -sS https://api.bevel.is/health | head -c 200; echo
  # Confirm SLACK keys exist on server (names only)
  ssh -o ConnectTimeout=15 "$SSH_HOST" \
    'sudo grep -E "^SLACK_" /opt/bevel/apps/web/.env.production | cut -d= -f1 | sort' \
    || warn "could not list prod SLACK_ keys"
}

print_slack_app_checklist() {
  cat <<'EOF'

── Slack app checklist (https://api.slack.com/apps) ──────────────────
1. Create app (From manifest) using scripts/slack-app-manifest.json
2. OAuth & Permissions → Redirect URLs:
   - https://bevel.is/api/integrations/slack/oauth/callback
   - https://bevel.lvh.me/api/integrations/slack/oauth/callback
3. Enable Token Rotation (cannot turn off later — use a dev app first if unsure)
4. Basic Information → copy Client ID, Client Secret, Signing Secret, App ID
5. Event Subscriptions → Request URL:
   https://bevel.is/api/integrations/slack/events
   (local: use Socket Mode or temporary tunnel if needed)
6. Install to workspace after scopes saved
7. Apply credentials:
   SLACK_CLIENT_ID=… SLACK_CLIENT_SECRET=… SLACK_SIGNING_SECRET=… SLACK_APP_ID=A… \
     ./scripts/setup-integrations-env.sh all
8. Restart local web: bash scripts/services.sh stop web && bash scripts/services.sh start web
9. Sign in → https://bevel.lvh.me/console/integrations → Connect Slack
   and/or https://bevel.is/console/integrations
──────────────────────────────────────────────────────────────────────
EOF
}

cmd="${1:-help}"
case "$cmd" in
  bluebubbles)
    ensure_secrets_dirs
    sync_bluebubbles_from_db
    ;;
  slack)
    ensure_secrets_dirs
    write_slack_local
    print_slack_app_checklist
    ;;
  slack-from-1p)
    ensure_secrets_dirs
    load_slack_from_1p
    write_slack_local
    write_slack_prod
    validate_local
    validate_prod
    ;;
  prod-slack)
    write_slack_prod
    validate_prod
    ;;
  all)
    ensure_secrets_dirs
    sync_bluebubbles_from_db || true
    if [[ -n "${SLACK_CLIENT_ID:-}" ]]; then
      write_slack_local
      write_slack_prod
    else
      warn "SLACK_* not in environment — skipping Slack write"
      print_slack_app_checklist
    fi
    validate_local
    validate_prod
    ;;
  validate)
    validate_local
    validate_prod
    ;;
  checklist)
    print_slack_app_checklist
    ;;
  help|*)
    sed -n '2,30p' "$0"
    print_slack_app_checklist
    ;;
esac
