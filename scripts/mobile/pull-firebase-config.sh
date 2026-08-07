#!/usr/bin/env bash
# Pull Firebase client config from 1Password into gitignored paths.
#
# 1Password item (create once): "BEVEL Firebase" in vault "dev"
#   - document/file field google-services.json
#   - document/file field GoogleService-Info.plist
#   - document/file field service-account.json  (server fan-out; never ship in app)
#   - text field project_id
#
# Usage:
#   ./scripts/mobile/pull-firebase-config.sh
#   OP_VAULT=dev OP_ITEM="BEVEL Firebase" ./scripts/mobile/pull-firebase-config.sh
#
# If the item is missing, prints exact op commands to create it.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
VAULT="${OP_VAULT:-dev}"
ITEM="${OP_ITEM:-BEVEL Firebase}"

if ! command -v op >/dev/null 2>&1; then
  echo "ERROR: 1Password CLI (op) not on PATH"
  exit 1
fi

echo "==> BEVEL Firebase config from op://$VAULT/$ITEM"

if ! op item get "$ITEM" --vault "$VAULT" >/dev/null 2>&1; then
  cat <<EOF
ERROR: 1Password item not found: "$ITEM" (vault $VAULT)

Create it after Firebase Console project setup:

  1. https://console.firebase.google.com → Add project "bevel" (or existing)
  2. Add Android app package com.derozic.bevel.bevel_app → download google-services.json
  3. Add iOS app bundle com.derozic.bevel.bevelApp → download GoogleService-Info.plist
  4. Project settings → Service accounts → Generate new private key
  5. Cloud Messaging → Apple app configuration → upload APNs Auth Key (.p8)

Then create the 1Password item (files as documents):

  op item create \\
    --category=SecureNote \\
    --title="$ITEM" \\
    --vault="$VAULT" \\
    'project_id[text]=YOUR_FIREBASE_PROJECT_ID' \\
    'notesPlain[text]=BEVEL FCM + APNs client + server service account'

  op item edit "$ITEM" --vault "$VAULT" \\
    --file-attachment google-services.json \\
    --file-attachment GoogleService-Info.plist \\
    --file-attachment service-account.json

  # Or store files as custom document fields named:
  #   google-services.json, GoogleService-Info.plist, service-account.json
EOF
  exit 2
fi

mkdir -p "$MOBILE/android/app" "$MOBILE/ios/Runner" "$MOBILE/macos/Runner" "$ROOT/secrets"

pull_field() {
  local field="$1"
  local dest="$2"
  # Try document / file field first, then notes attachment by name
  if op read "op://$VAULT/$ITEM/$field" >"$dest" 2>/dev/null; then
    echo "    OK $field → $dest ($(wc -c <"$dest" | tr -d ' ') bytes)"
    return 0
  fi
  # Alternate path: document title
  if op document get "$field" --vault "$VAULT" >"$dest" 2>/dev/null; then
    echo "    OK document $field → $dest"
    return 0
  fi
  echo "    MISS $field (add to 1Password item)"
  rm -f "$dest"
  return 1
}

ok=0
pull_field "google-services.json" "$MOBILE/android/app/google-services.json" && ok=$((ok + 1)) || true
pull_field "GoogleService-Info.plist" "$MOBILE/ios/Runner/GoogleService-Info.plist" && ok=$((ok + 1)) || true
# Optional macOS same plist
if [[ -f "$MOBILE/ios/Runner/GoogleService-Info.plist" ]]; then
  cp -f "$MOBILE/ios/Runner/GoogleService-Info.plist" \
    "$MOBILE/macos/Runner/GoogleService-Info.plist" 2>/dev/null || true
fi
pull_field "service-account.json" "$ROOT/secrets/firebase-service-account.json" && ok=$((ok + 1)) || true

echo ""
echo "Pulled $ok file(s). Client files are gitignored."
if [[ -f "$ROOT/secrets/firebase-service-account.json" ]]; then
  echo "Server env (production API host):"
  echo "  export FIREBASE_SERVICE_ACCOUNT_PATH=/opt/bevel/secrets/firebase-service-account.json"
  echo "  # or FIREBASE_SERVICE_ACCOUNT_JSON=\$(cat secrets/firebase-service-account.json)"
fi
echo "See docs/NATIVE_PUSH.md"
