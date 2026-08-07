#!/usr/bin/env bash
# Deploy BEVEL to connected physical devices (iPhone + Android).
#
# Usage:
#   ./scripts/mobile/deploy-devices.sh           # auto-detect
#   ./scripts/mobile/deploy-devices.sh ios
#   ./scripts/mobile/deploy-devices.sh android
#   ./scripts/mobile/deploy-devices.sh both
#
# iPhone: unlock screen first. Prefer USB cable over wireless for first install.
# Android: USB debugging on; approve RSA prompt.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
cd "$MOBILE"

TARGET="${1:-both}"
DEFINES=(
  --dart-define=BEVEL_BASE_URL="${BEVEL_BASE_URL:-https://bevel.is}"
  --dart-define=BEVEL_API_URL="${BEVEL_API_URL:-https://api.bevel.is}"
  --dart-define=BEVEL_WORKSPACE_URL="${BEVEL_WORKSPACE_URL:-https://bevel.2x4m.cc}"
)

echo "==> BEVEL device deploy"
echo "    defines: production hosts"

pick_ios() {
  # Prefer wireless/USB physical iPhone named z17 or matching UDID pattern
  flutter devices --machine 2>/dev/null | python3 -c '
import sys, json
devs = json.load(sys.stdin)
for d in devs:
  if d.get("targetPlatform") != "ios":
    continue
  if d.get("emulator"):
    continue
  if d.get("isSupported") is False:
    continue
  print(d["id"])
  sys.exit(0)
print("")
' 2>/dev/null || true
}

pick_android() {
  flutter devices --machine 2>/dev/null | python3 -c '
import sys, json
devs = json.load(sys.stdin)
for d in devs:
  if d.get("targetPlatform") != "android":
    continue
  if d.get("emulator"):
    continue
  if d.get("isSupported") is False:
    continue
  print(d["id"])
  sys.exit(0)
print("")
' 2>/dev/null || true
}

deploy_ios() {
  local id
  id="$(pick_ios)"
  if [[ -z "$id" ]]; then
    echo "ERROR: no physical iPhone found. Unlock + plug in USB (or enable wireless debugging)."
    flutter devices 2>&1 | head -20 || true
    return 1
  fi
  echo "==> iOS → $id"
  # Build release then install/launch (more reliable than flutter run wireless VM)
  flutter build ios --release --no-codesign "${DEFINES[@]}" 2>&1 | tail -5 || true
  # Prefer codesigned device build via flutter install
  flutter install -d "$id" "${DEFINES[@]}" 2>&1 || \
    flutter run -d "$id" --release "${DEFINES[@]}" 2>&1
  # Best-effort launch via CoreDevice
  xcrun devicectl device process launch --device "$id" com.derozic.bevel.bevelApp 2>&1 || true
  echo "    iOS: open BEVEL on the phone if launch was blocked (unlock first)."
}

deploy_android() {
  local id
  id="$(pick_android)"
  if [[ -z "$id" ]]; then
    echo "ERROR: no physical Android. Enable USB debugging and connect the Fold."
    adb devices -l || true
    return 1
  fi
  echo "==> Android → $id"
  flutter run -d "$id" --release "${DEFINES[@]}" 2>&1
}

case "$TARGET" in
  ios) deploy_ios ;;
  android) deploy_android ;;
  both|all|"")
    ios_ok=0
    and_ok=0
    deploy_ios && ios_ok=1 || true
    deploy_android && and_ok=1 || true
    if [[ $ios_ok -eq 0 && $and_ok -eq 0 ]]; then
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 [ios|android|both]"
    exit 2
    ;;
esac
echo "==> Done"
