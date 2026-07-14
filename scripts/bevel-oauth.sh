#!/usr/bin/env bash
# BEVEL Google OAuth helper.
#
# Google does NOT provide a public gcloud/API to create OAuth 2.0 *Web* clients
# (redirect URIs / JS origins). That step is Console-only.
# This script opens the right Console pages and applies credentials to .env.
#
# Usage:
#   ./scripts/bevel-oauth.sh open          # open create + scopes + branding
#   ./scripts/bevel-oauth.sh edit-existing # open the shared 2x4m web client (fastest)
#   ./scripts/bevel-oauth.sh apply <CLIENT_ID> <CLIENT_SECRET>
#   ./scripts/bevel-oauth.sh status

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
PROJECT="${GCP_PROJECT_ID:-x4m-493516}"
# Shared platform web client already used by 2x4m apps (project number 336973686985)
EXISTING_CLIENT="${BEVEL_EXISTING_OAUTH_CLIENT:-336973686985-hmkvu3ijv3a3ajimi0q8o47jc2aou02l.apps.googleusercontent.com}"

ORIGINS=(
  "https://bevel.lvh.me"
  "https://demo.bevel.lvh.me"
)
REDIRECTS=(
  "https://bevel.lvh.me/api/auth/callback/google"
  "https://demo.bevel.lvh.me/api/auth/callback/google"
)

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # portable in-place
    python3 - "$ENV_FILE" "$key" "$value" <<'PY'
import re, sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
pat = re.compile(rf"^{re.escape(key)}=.*$", re.M)
line = f"{key}={value}"
text = pat.sub(line, text) if pat.search(text) else text.rstrip() + "\n" + line + "\n"
open(path, "w").write(text)
PY
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

cmd_open() {
  echo "Opening Google Auth Platform pages for project: $PROJECT"
  echo
  echo "Create client values:"
  echo "  Name: BEVEL Web"
  echo "  Type: Web application"
  echo "  Origins:"
  printf '    %s\n' "${ORIGINS[@]}"
  echo "  Redirects:"
  printf '    %s\n' "${REDIRECTS[@]}"
  echo
  open "https://console.cloud.google.com/auth/clients/create?project=${PROJECT}"
  open "https://console.cloud.google.com/auth/scopes?project=${PROJECT}"
  open "https://console.cloud.google.com/auth/branding?project=${PROJECT}"
  echo "After Create, run:"
  echo "  $0 apply <CLIENT_ID> <CLIENT_SECRET>"
}

cmd_edit_existing() {
  echo "Fastest path: add BEVEL origins/redirects to the existing 2x4m web client"
  echo "  Client: $EXISTING_CLIENT"
  echo "  Project: $PROJECT"
  echo
  echo "Add these Authorized JavaScript origins:"
  printf '  %s\n' "${ORIGINS[@]}"
  echo
  echo "Add these Authorized redirect URIs:"
  printf '  %s\n' "${REDIRECTS[@]}"
  echo
  open "https://console.cloud.google.com/apis/credentials/oauthclient/${EXISTING_CLIENT}?project=${PROJECT}"
  open "https://console.cloud.google.com/auth/clients?project=${PROJECT}"
  echo
  echo "Credentials are already in bevel .env from this client."
  echo "After saving URIs, restart web and open https://bevel.lvh.me/login"
}

cmd_apply() {
  local id="${1:-}" secret="${2:-}"
  if [[ -z "$id" || -z "$secret" ]]; then
    echo "usage: $0 apply <CLIENT_ID> <CLIENT_SECRET>" >&2
    exit 2
  fi
  [[ -f "$ENV_FILE" ]] || cp "$ROOT/.env.example" "$ENV_FILE"
  set_env AUTH_GOOGLE_ID "$id"
  set_env AUTH_GOOGLE_SECRET "$secret"
  set_env AUTH_GOOGLE_HD "derozic.com"
  set_env AUTH_TRUST_HOST "true"
  set_env AUTH_URL "https://bevel.lvh.me"
  set_env NEXTAUTH_URL "https://bevel.lvh.me"
  echo "Wrote Google OAuth keys to $ENV_FILE"
  echo "Restart web to pick up env, then:"
  echo "  curl -s https://bevel.lvh.me/api/auth/providers"
  echo "  open https://bevel.lvh.me/login?callbackUrl=%2Fbevel"
}

cmd_status() {
  python3 - "$ENV_FILE" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
t = p.read_text() if p.exists() else ""
for k in ["AUTH_GOOGLE_ID","AUTH_GOOGLE_SECRET","AUTH_URL","NEXTAUTH_URL","AUTH_GOOGLE_HD","AUTH_TRUST_HOST"]:
    m = re.search(rf"^{re.escape(k)}=(.*)$", t, re.M)
    v = m.group(1) if m else ""
    print(f"{k}: {'set' if v.strip() else 'MISSING'} (len={len(v)})")
PY
  echo
  echo "Providers endpoint:"
  curl -sS --max-time 8 "https://bevel.lvh.me/api/auth/providers" || echo "(web not reachable)"
  echo
}

case "${1:-}" in
  open) cmd_open ;;
  edit-existing|edit) cmd_edit_existing ;;
  apply) shift; cmd_apply "$@" ;;
  status) cmd_status ;;
  *)
    cat <<EOF
BEVEL Google OAuth helper

Google does not expose a public CLI to create OAuth Web clients.
Use Console for client create/edit; use this script for wiring.

  $0 edit-existing   # open existing 2x4m client — add BEVEL URIs (recommended)
  $0 open            # open Create Client + scopes + branding
  $0 apply ID SECRET # write credentials into .env
  $0 status          # show env + /api/auth/providers
EOF
    exit 1
    ;;
esac
