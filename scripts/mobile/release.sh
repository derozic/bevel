#!/usr/bin/env bash
# Build BEVEL Flutter release bundles for iOS, Android, and macOS (Apple Silicon).
#
# Usage:
#   ./scripts/mobile/release.sh              # all platforms that can build here
#   ./scripts/mobile/release.sh macos        # Apple Silicon .app
#   ./scripts/mobile/release.sh android      # APK + App Bundle
#   ./scripts/mobile/release.sh ios          # iOS release (needs signing)
#
# Default: always live production (bevel.is / api.bevel.is / bevel.2x4m.cc).
# Local Caddy only when BEVEL_ENV=local:
#   BEVEL_ENV=local ./scripts/mobile/release.sh macos
#
# Artifacts land in dist/native/<version>/

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
VERSION="$(grep -E '^version:' "$MOBILE/pubspec.yaml" | awk '{print $2}' | cut -d+ -f1)"
OUT="$ROOT/dist/native/$VERSION"
ENV_NAME="${BEVEL_ENV:-production}"

# Live by default. Opt into local with BEVEL_ENV=local.
if [[ "$ENV_NAME" == "local" || "$ENV_NAME" == "dev" ]]; then
  # Caddy host is bevel.2x4m.lvh.me (NOT 2x4m.bevel.lvh.me — no TLS site).
  BASE_URL="${BEVEL_BASE_URL:-https://bevel.2x4m.lvh.me}"
  API_URL="${BEVEL_API_URL:-https://api.bevel.lvh.me}"
  WORKSPACE_URL="${BEVEL_WORKSPACE_URL:-https://bevel.2x4m.lvh.me}"
else
  BASE_URL="${BEVEL_BASE_URL:-https://bevel.is}"
  API_URL="${BEVEL_API_URL:-https://api.bevel.is}"
  WORKSPACE_URL="${BEVEL_WORKSPACE_URL:-https://bevel.2x4m.cc}"
fi

DART_DEFINES=(
  --dart-define="BEVEL_BASE_URL=$BASE_URL"
  --dart-define="BEVEL_API_URL=$API_URL"
)
if [[ -n "$WORKSPACE_URL" ]]; then
  DART_DEFINES+=(--dart-define="BEVEL_WORKSPACE_URL=$WORKSPACE_URL")
fi

TARGET="${1:-all}"
ARCH="$(uname -m)"

mkdir -p "$OUT"
cd "$MOBILE"

echo "==> BEVEL native release v$VERSION"
echo "    env: $ENV_NAME"
echo "    base URL: $BASE_URL"
echo "    api URL: $API_URL"
echo "    workspace URL: ${WORKSPACE_URL:-$BASE_URL}"
echo "    host arch: $ARCH"
echo "    output: $OUT"

if [[ "$ARCH" != "arm64" && ( "$TARGET" == "macos" || "$TARGET" == "all" ) ]]; then
  echo "WARN: macOS Silicon bundle expects arm64 host (got $ARCH)."
fi

build_macos() {
  echo "==> macOS (Apple Silicon / arm64)"
  flutter build macos --release "${DART_DEFINES[@]}"
  local products="$MOBILE/build/macos/Build/Products/Release"
  # PRODUCT_NAME is BEVEL (AppInfo.xcconfig). Prefer that over stale bevel_app.app
  # leftovers from older builds (those lack network.client → every HTTPS link fails).
  local app=""
  for candidate in "$products/BEVEL.app" "$products/bevel_app.app"; do
    if [[ -d "$candidate" ]]; then
      app="$candidate"
      break
    fi
  done
  if [[ -z "$app" ]]; then
    app="$(find "$products" -maxdepth 1 -name '*.app' -print0 2>/dev/null \
      | xargs -0 ls -td 2>/dev/null | head -1)"
  fi
  if [[ -z "${app:-}" || ! -d "$app" ]]; then
    echo "ERROR: macOS .app not found after build in $products"
    exit 1
  fi
  echo "    packaging: $app"

  local dest="$OUT/BEVEL-macos-arm64.app"
  rm -rf "$dest" "$OUT/BEVEL-macos-arm64.zip"
  cp -R "$app" "$dest"

  # Ensure sandbox allows outbound HTTPS + mic/camera (stale copies sometimes drop these).
  local ents="$MOBILE/macos/Runner/Release.entitlements"
  if [[ -f "$ents" ]]; then
    codesign --force --deep --sign - --entitlements "$ents" "$dest" 2>/dev/null \
      || codesign --force --deep --sign - --entitlements "$ents" "$dest"
  fi

  # Fail fast if network.client is missing (sandboxed app cannot load any URL).
  if ! codesign -d --entitlements - "$dest" 2>/dev/null | grep -q 'network.client'; then
    echo "ERROR: packaged app missing com.apple.security.network.client"
    codesign -d --entitlements - "$dest" 2>&1 || true
    exit 1
  fi

  (cd "$OUT" && zip -qry "BEVEL-macos-arm64.zip" "BEVEL-macos-arm64.app")
  local binary
  binary="$(find "$dest/Contents/MacOS" -type f | head -1)"
  if [[ -n "$binary" ]]; then
    file "$binary" | tee "$OUT/BEVEL-macos-arm64.arch.txt"
  fi
  echo "    -> $dest"
  echo "    -> $OUT/BEVEL-macos-arm64.zip"
  echo "    entitlements: network.client OK"
}

build_android() {
  echo "==> Android (APK + App Bundle)"
  flutter build apk --release "${DART_DEFINES[@]}"
  flutter build appbundle --release "${DART_DEFINES[@]}"
  cp -f "$MOBILE/build/app/outputs/flutter-apk/app-release.apk" \
    "$OUT/BEVEL-android-release.apk"
  cp -f "$MOBILE/build/app/outputs/bundle/release/app-release.aab" \
    "$OUT/BEVEL-android-release.aab"
  echo "    -> $OUT/BEVEL-android-release.apk"
  echo "    -> $OUT/BEVEL-android-release.aab"
}

build_ios() {
  echo "==> iOS (no codesign IPA for CI / local archive)"
  # Unsigned release build for CI; signing happens in Xcode / App Store Connect.
  if flutter build ios --release --no-codesign "${DART_DEFINES[@]}"; then
    local ios_out="$MOBILE/build/ios/iphoneos"
    if [[ -d "$ios_out" ]]; then
      rm -rf "$OUT/BEVEL-ios-Runner.app"
      # Prefer Runner.app
      if [[ -d "$ios_out/Runner.app" ]]; then
        cp -R "$ios_out/Runner.app" "$OUT/BEVEL-ios-Runner.app"
      else
        local found
        found="$(find "$ios_out" -maxdepth 1 -name '*.app' | head -1)"
        [[ -n "$found" ]] && cp -R "$found" "$OUT/BEVEL-ios-Runner.app"
      fi
      if [[ -d "$OUT/BEVEL-ios-Runner.app" ]]; then
        (cd "$OUT" && zip -qry "BEVEL-ios-unsigned.zip" "BEVEL-ios-Runner.app")
        echo "    -> $OUT/BEVEL-ios-Runner.app (unsigned)"
        echo "    -> $OUT/BEVEL-ios-unsigned.zip"
      fi
    fi
  else
    echo "WARN: iOS build failed (Xcode / signing toolchain required)."
  fi
}

case "$TARGET" in
  macos) build_macos ;;
  android) build_android ;;
  ios) build_ios ;;
  all)
    build_macos
    build_android || echo "WARN: Android build skipped/failed (SDK may be missing)."
    build_ios || true
    ;;
  *)
    echo "Usage: $0 [all|macos|android|ios]"
    exit 2
    ;;
esac

# Manifest for download page / release notes
cat > "$OUT/MANIFEST.txt" <<EOF
BEVEL native release
version: $VERSION
env: $ENV_NAME
base_url: $BASE_URL
api_url: $API_URL
workspace_url: ${WORKSPACE_URL:-$BASE_URL}
built_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
host: $(uname -s) $(uname -m)
targets: $TARGET
EOF

echo "==> Done. Artifacts in $OUT"
ls -la "$OUT"
