#!/usr/bin/env bash
# Build BEVEL Flutter release bundles for iOS, Android, and macOS (Apple Silicon).
#
# Usage:
#   ./scripts/mobile/release.sh              # all platforms that can build here
#   ./scripts/mobile/release.sh macos        # Apple Silicon .app
#   ./scripts/mobile/release.sh android      # APK + App Bundle
#   ./scripts/mobile/release.sh ios          # iOS release (needs signing)
#   BEVEL_BASE_URL=https://app.example.com ./scripts/mobile/release.sh macos
#
# Artifacts land in dist/native/<version>/

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
VERSION="$(grep -E '^version:' "$MOBILE/pubspec.yaml" | awk '{print $2}' | cut -d+ -f1)"
OUT="$ROOT/dist/native/$VERSION"
BASE_URL="${BEVEL_BASE_URL:-https://2x4m.bevel.lvh.me}"
DART_DEFINES=(--dart-define="BEVEL_BASE_URL=$BASE_URL")

TARGET="${1:-all}"
ARCH="$(uname -m)"

mkdir -p "$OUT"
cd "$MOBILE"

echo "==> BEVEL native release v$VERSION"
echo "    base URL: $BASE_URL"
echo "    host arch: $ARCH"
echo "    output: $OUT"

if [[ "$ARCH" != "arm64" && ( "$TARGET" == "macos" || "$TARGET" == "all" ) ]]; then
  echo "WARN: macOS Silicon bundle expects arm64 host (got $ARCH)."
fi

build_macos() {
  echo "==> macOS (Apple Silicon / arm64)"
  flutter build macos --release "${DART_DEFINES[@]}"
  local app="$MOBILE/build/macos/Build/Products/Release/bevel_app.app"
  if [[ ! -d "$app" ]]; then
    # Product name may match CFBundleName
    app="$(find "$MOBILE/build/macos/Build/Products/Release" -maxdepth 1 -name '*.app' | head -1)"
  fi
  if [[ -z "${app:-}" || ! -d "$app" ]]; then
    echo "ERROR: macOS .app not found after build"
    exit 1
  fi
  local dest="$OUT/BEVEL-macos-arm64.app"
  rm -rf "$dest" "$OUT/BEVEL-macos-arm64.zip"
  cp -R "$app" "$dest"
  (cd "$OUT" && zip -qry "BEVEL-macos-arm64.zip" "BEVEL-macos-arm64.app")
  # Record binary arch
  local binary
  binary="$(find "$dest/Contents/MacOS" -type f | head -1)"
  if [[ -n "$binary" ]]; then
    file "$binary" | tee "$OUT/BEVEL-macos-arm64.arch.txt"
  fi
  echo "    -> $dest"
  echo "    -> $OUT/BEVEL-macos-arm64.zip"
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
base_url: $BASE_URL
built_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
host: $(uname -s) $(uname -m)
targets: $TARGET
EOF

echo "==> Done. Artifacts in $OUT"
ls -la "$OUT"
