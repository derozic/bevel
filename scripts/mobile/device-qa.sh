#!/usr/bin/env bash
# Device QA checklist for consumer chat (iOS / Android / macOS).
# Prints steps and optionally launches the app on a connected device.
#
# Usage:
#   ./scripts/mobile/device-qa.sh              # print checklist
#   ./scripts/mobile/device-qa.sh run ios      # flutter run production defines
#   ./scripts/mobile/device-qa.sh run android
#   ./scripts/mobile/device-qa.sh run macos

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
VER="$(grep -E '^version:' "$MOBILE/pubspec.yaml" | awk '{print $2}')"

BASE_URL="${BEVEL_BASE_URL:-https://bevel.is}"
API_URL="${BEVEL_API_URL:-https://api.bevel.is}"
WORKSPACE_URL="${BEVEL_WORKSPACE_URL:-https://bevel.2x4m.cc}"

print_checklist() {
  cat <<EOF
══════════════════════════════════════════════════════════════
 BEVEL device QA — pubspec $VER
 Workspace: $WORKSPACE_URL
══════════════════════════════════════════════════════════════

Preflight
  [ ] ./scripts/mobile/pull-firebase-config.sh   (Firebase plists present)
  [ ] flutter devices shows target phone/tablet
  [ ] Signed into Google Workspace once on this device

A. Cold start → chat
  [ ] Kill app completely
  [ ] Relaunch — should auto-open last channel (or ~general) if signed in
  [ ] No developer "Native integrations" primary CTA on home
  [ ] App bar shows channel label (~general / talk/hermes)

B. OAuth handoff
  [ ] Sign out (or clear WebView data) if testing fresh
  [ ] Continue with Google → system browser → finish SSO
  [ ] App returns via bevel://auth/complete
  [ ] WebView lands on workspace ~general with session-ok
  [ ] No infinite redirect / cookie loop

C. Channel switch
  [ ] Phone: tap channel FAB / tag icon → sheet lists channels
  [ ] Switch ~general → ~ops (or available) — messages load
  [ ] Timeline opens from sheet / app bar
  [ ] Hermes / Private entries open /talk/hermes and /me
  [ ] Tablet/mac: left rail navigates without full reload thrash

D. Keyboard + composer
  [ ] Tap composer — keyboard does not cover send field permanently
  [ ] Type and send a short message — appears in thread
  [ ] Scroll history (older messages) still works after send
  [ ] Rotate device (if phone) — layout recovers

E. Push (requires Firebase + server account)
  [ ] Grant notification permission after first workspace open
  [ ] Token registered: GET api with fleet key /push-tokens? or check logs
  [ ] Internal test:
        curl -sS -X POST https://api.bevel.is/api/v1/devices/push-send \\
          -H "X-Fleet-Internal-Key: \$FLEET_INTERNAL_API_KEY" \\
          -H "Content-Type: application/json" \\
          -d '{"userId":"YOUR_USER_ID","title":"QA","body":"tap me","deepLink":"bevel://channel/general"}'
  [ ] Tap notification → opens correct channel
  [ ] Soft @mention and hard ^escalation paths (from another user)

F. Console stays web-only
  [ ] In-app navigation to /console opens system browser (or is blocked)
  [ ] Chat still works after returning

Sign-off
  Device: ________  OS: ________  Build: $VER
  Tester: ________  Date: ________
  Pass / Fail: ________  Notes: ________

Artifacts / store
  ./scripts/mobile/store-checklist.sh
  ./scripts/mobile/release.sh [ios|android|macos]
══════════════════════════════════════════════════════════════
EOF
}

run_app() {
  local target="${1:-}"
  cd "$MOBILE"
  local defines=(
    --dart-define="BEVEL_BASE_URL=$BASE_URL"
    --dart-define="BEVEL_API_URL=$API_URL"
    --dart-define="BEVEL_WORKSPACE_URL=$WORKSPACE_URL"
  )
  if [[ -n "${FLEET_INTERNAL_API_KEY:-}" ]]; then
    defines+=(--dart-define="FLEET_INTERNAL_API_KEY=$FLEET_INTERNAL_API_KEY")
  fi
  case "$target" in
    ios|android|macos)
      echo "==> flutter run -d $target (production hosts)"
      flutter run -d "$target" "${defines[@]}"
      ;;
    *)
      echo "Usage: $0 run [ios|android|macos]"
      exit 2
      ;;
  esac
}

case "${1:-checklist}" in
  checklist|"") print_checklist ;;
  run) run_app "${2:-}" ;;
  *)
    echo "Usage: $0 [checklist|run ios|run android|run macos]"
    exit 2
    ;;
esac
