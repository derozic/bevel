#!/usr/bin/env bash
# Register production Google OAuth redirect URIs (manual in Cloud Console)
# then verify Google accepts https://bevel.is/api/auth/callback/google.
#
# Usage:
#   ./scripts/fix-google-oauth-prod.sh
#   ./scripts/fix-google-oauth-prod.sh --verify-only
#
set -euo pipefail

CLIENT_ID="${AUTH_GOOGLE_ID:-336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com}"
# strip quotes if from env
CLIENT_ID="${CLIENT_ID%\"}"
CLIENT_ID="${CLIENT_ID#\"}"
PROJECT="${GCP_PROJECT:-x4m-493516}"
REDIRECT='https://bevel.is/api/auth/callback/google'
CONSOLE_URL="https://console.cloud.google.com/apis/credentials/oauthclient/${CLIENT_ID}?project=${PROJECT}"

ORIGINS=(
  'https://bevel.is'
  'https://www.bevel.is'
  'https://bevel.2x4m.cc'
  'https://bevel.lvh.me'
)
REDIRECTS=(
  'https://bevel.is/api/auth/callback/google'
  'https://www.bevel.is/api/auth/callback/google'
  'https://bevel.2x4m.cc/api/auth/callback/google'
  'https://bevel.lvh.me/api/auth/callback/google'
)

verify() {
  local enc
  enc="$(python3 -c "import urllib.parse; print(urllib.parse.quote('${REDIRECT}', safe=''))")"
  local loc
  loc="$(
    curl -sS -o /dev/null -w '%{redirect_url}' \
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${enc}&response_type=code&scope=openid%20email%20profile&prompt=select_account" \
      || true
  )"
  if echo "$loc" | grep -q 'redirect_uri_mismatch'; then
    echo "FAIL: redirect_uri_mismatch — Google still does not list:"
    echo "      ${REDIRECT}"
    return 1
  fi
  if echo "$loc" | grep -qi 'invalid_client\|deleted_client\|OAuth client was not found'; then
    echo "FAIL: invalid_client — check AUTH_GOOGLE_ID/SECRET on the server"
    echo "      ${loc:0:160}"
    return 1
  fi
  if echo "$loc" | grep -q 'authError='; then
    echo "FAIL: Google authError still present"
    echo "      ${loc:0:200}"
    return 1
  fi
  if echo "$loc" | grep -qi 'accounts.google.com'; then
    echo "OK: Google accepted redirect_uri (account chooser / consent)"
    return 0
  fi
  echo "WARN: unexpected response: ${loc:0:200}"
  return 1
}

if [[ "${1:-}" == "--verify-only" ]]; then
  verify
  exit $?
fi

cat <<EOF

══════════════════════════════════════════════════════════════════
  BEVEL production Google OAuth — one-time Cloud Console fix
══════════════════════════════════════════════════════════════════

1. Cloud Console is opening for client:
   ${CLIENT_ID}

2. Under **Authorized JavaScript origins**, add (if missing):
EOF
for u in "${ORIGINS[@]}"; do echo "     - ${u}"; done
cat <<EOF

3. Under **Authorized redirect URIs**, add (if missing):
EOF
for u in "${REDIRECTS[@]}"; do echo "     - ${u}"; done
cat <<EOF

4. Click **SAVE**. Wait ~30–60s for Google to propagate.

5. This script will poll until the redirect is accepted.

══════════════════════════════════════════════════════════════════
EOF

# clipboard: one URI per line for paste
{
  printf '%s\n' "${ORIGINS[@]}"
  printf '%s\n' "${REDIRECTS[@]}"
} | pbcopy 2>/dev/null || true
echo "(origins + redirect URIs copied to clipboard)"

open "${CONSOLE_URL}" 2>/dev/null || true

echo ""
echo "Polling Google for redirect acceptance (up to ~4 minutes)…"
for i in $(seq 1 48); do
  if verify; then
    echo ""
    echo "Verifying BEVEL sign-in endpoint…"
    CSRF="$(curl -sS -c /tmp/bevel-oauth-cj 'https://bevel.is/api/auth/csrf' | python3 -c 'import sys,json; print(json.load(sys.stdin)["csrfToken"])')"
    LOC="$(
      curl -sS -b /tmp/bevel-oauth-cj -c /tmp/bevel-oauth-cj -o /dev/null -w '%{redirect_url}' \
        -X POST 'https://bevel.is/api/auth/signin/google' \
        -H 'Content-Type: application/x-www-form-urlencoded' \
        --data-urlencode "csrfToken=${CSRF}" \
        --data-urlencode 'callbackUrl=/welcome'
    )"
    echo "Auth.js → ${LOC:0:120}…"
    if echo "$LOC" | grep -q 'accounts.google.com/o/oauth2'; then
      echo ""
      echo "NAILED: production Google login is ready."
      echo "Open: https://bevel.is/login?callbackUrl=%2Fwelcome"
      open 'https://bevel.is/login?callbackUrl=%2Fwelcome' 2>/dev/null || true
      exit 0
    fi
    echo "Auth.js did not hand off to Google — check server env / journal."
    exit 1
  fi
  printf '[%s/48] still waiting…\n' "$i"
  sleep 5
done

echo "TIMEOUT: save the Cloud Console client and re-run:"
echo "  ./scripts/fix-google-oauth-prod.sh --verify-only"
exit 1
