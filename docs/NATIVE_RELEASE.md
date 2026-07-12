# BEVEL native release (iOS · Android · macOS Silicon)

One Flutter app lives at `apps/mobile` and produces three platform bundles:

| Platform | Artifact | Notes |
|----------|----------|--------|
| **iOS** | `BEVEL-ios-Runner.app` / TestFlight IPA | Signed in Xcode or CI with Apple distribution cert |
| **Android** | `BEVEL-android-release.apk` + `.aab` | Play Store uses AAB; APK for sideload |
| **macOS Silicon** | `BEVEL-macos-arm64.app` + `.zip` | **arm64 only** (M1/M2/M3/M4). Intel not supported |

## Prerequisites

- Flutter stable (3.22+), on an **Apple Silicon Mac** for macOS arm64 builds
- Xcode + CocoaPods for iOS / macOS
- Android SDK + JDK for Android
- Optional: Apple Developer Program for App Store / TestFlight; Google Play console for Play

```bash
flutter doctor
cd apps/mobile && flutter pub get
```

## Local release builds

From the monorepo root:

```bash
# All platforms available on this machine
./scripts/mobile/release.sh

# Single target
./scripts/mobile/release.sh macos
./scripts/mobile/release.sh android
./scripts/mobile/release.sh ios

# Production workspace origin
BEVEL_BASE_URL=https://app.bevel.com ./scripts/mobile/release.sh macos
```

Artifacts:

```
dist/native/<version>/
  BEVEL-macos-arm64.app
  BEVEL-macos-arm64.zip
  BEVEL-macos-arm64.arch.txt
  BEVEL-android-release.apk
  BEVEL-android-release.aab
  BEVEL-ios-Runner.app          # unsigned unless codesigned
  BEVEL-ios-unsigned.zip
  MANIFEST.txt
```

`dist/` is gitignored. Attach bundles to a GitHub Release or host them for the `/download` page.

## Dev run

```bash
cd apps/mobile
flutter run -d macos \
  --dart-define=BEVEL_BASE_URL=https://2x4m.bevel.lvh.me
```

## Signing (production)

### iOS

1. Open `apps/mobile/ios/Runner.xcworkspace` in Xcode
2. Set Team, Bundle ID (`com.derozic.bevel.bevelApp` by default)
3. Archive → Distribute App → App Store Connect / TestFlight
4. Or: `flutter build ipa --release --dart-define=BEVEL_BASE_URL=…`

### Android

1. Create an upload keystore (store in 1Password; never commit)
2. Configure `android/key.properties` (gitignored) pointing at the keystore
3. `flutter build appbundle --release`

### macOS Silicon

1. Build on arm64 host: `./scripts/mobile/release.sh macos`
2. Optional: codesign + notarize for Gatekeeper:

```bash
codesign --deep --force --options runtime \
  --sign "Developer ID Application: …" \
  dist/native/0.1.0/BEVEL-macos-arm64.app
xcrun notarytool submit dist/native/0.1.0/BEVEL-macos-arm64.zip \
  --apple-id … --team-id … --wait
```

## Versioning

- `apps/mobile/pubspec.yaml` → `version: 0.1.0+1` (name+build)
- Bump **build number** on every store upload; bump **name** for user-facing releases
- Keep monorepo `package.json` version in step for coordinated tags (`v0.1.0`)

## CI

Workflow: `.github/workflows/native-release.yml`

- Runs on `macos-latest` (Apple Silicon runners when available)
- Builds macOS + Android (if SDK present) on tag `v*`
- iOS archive step is gated on secrets / optional job
- Uploads `dist/native/**` as workflow artifacts

## Download page

Web: `https://<tenant>.bevel.lvh.me/download` (or production host)

When release artifacts are published, update that page’s store / direct-download links. Until then the page documents the three targets and points operators at this pipeline.

## Roadmap toward “completed” store bundles

1. **Done:** Flutter scaffold, arm64 macOS + Android + iOS build scripts, download UX
2. **Next:** In-app WebView / deep links for SSO cookies; push notifications
3. **Next:** Signed TestFlight + Play internal track + notarized macOS zip
4. **Then:** Store listings, privacy nutrition labels, production `BEVEL_BASE_URL`
