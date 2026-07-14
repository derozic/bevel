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
  --dart-define=BEVEL_BASE_URL=https://2x4m.bevel.lvh.me \
  --dart-define=BEVEL_API_URL=https://api.bevel.lvh.me
```

## Signing (production)

Store all certs and keystore passwords in **1Password** (item titles like
`BEVEL Apple Distribution`, `BEVEL Android Play Upload Keystore`). Never commit
secrets.

### iOS

1. Open `apps/mobile/ios/Runner.xcworkspace` in Xcode
2. Set Team, Bundle ID (`com.derozic.bevel.bevelApp` by default)
3. Enable capabilities: **HealthKit**, **Push Notifications**, **Associated Domains**
4. Archive → Distribute App → App Store Connect / TestFlight
5. Or: `flutter build ipa --release --dart-define=BEVEL_BASE_URL=…`

App Store Connect checklist:

- [ ] Privacy nutrition labels (Health, notifications, identifiers)
- [ ] Export compliance / encryption answers
- [ ] Screenshots for iPhone (+ iPad if needed)
- [ ] Production `BEVEL_BASE_URL` dart-define on the archive

### Android

1. Create an upload keystore (store in 1Password; never commit)

```bash
keytool -genkey -v -keystore bevel-upload.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias bevel
```

2. Copy `apps/mobile/android/key.properties.example` → `android/key.properties`
   (gitignored) pointing at the keystore
3. Wire `key.properties` into `android/app/build.gradle.kts` signingConfigs when
   ready for Play (template lives next to the example)
4. `flutter build appbundle --release --dart-define=BEVEL_BASE_URL=…`

Play Console checklist:

- [ ] Health Connect declaration if shipping health APIs
- [ ] Data safety form aligned with privacy strings
- [ ] Internal testing track before production

### macOS Silicon

1. Build on arm64 host: `./scripts/mobile/release.sh macos`
2. Codesign + notarize for Gatekeeper:

```bash
codesign --deep --force --options runtime \
  --sign "Developer ID Application: …" \
  dist/native/0.1.0/BEVEL-macos-arm64.app
ditto -c -k --keepParent \
  dist/native/0.1.0/BEVEL-macos-arm64.app \
  dist/native/0.1.0/BEVEL-macos-arm64.zip
xcrun notarytool submit dist/native/0.1.0/BEVEL-macos-arm64.zip \
  --apple-id … --team-id … --wait
xcrun stapler staple dist/native/0.1.0/BEVEL-macos-arm64.app
```

## Versioning

- `apps/mobile/pubspec.yaml` → `version: 0.1.0+1` (name+build)
- Bump **build number** on every store upload; bump **name** for user-facing releases
- Keep monorepo `package.json` version in step for coordinated tags (`v0.1.0`)

## CI

Workflow: `.github/workflows/native-release.yml`

- Runs on `macos-latest` (Apple Silicon runners when available)
- Builds macOS + Android on tag `v*` and workflow_dispatch
- **Fails the job when `release.sh` fails** (no `|| true` swallow)
- iOS unsigned archive is a separate job
- Uploads `dist/native/**` as workflow artifacts (`if-no-files-found: error`)

## Download page

Web: `https://<tenant>.bevel.lvh.me/download` (or production host)

When release artifacts are published, update that page’s store / direct-download links. Until then the page documents the three targets and points operators at this pipeline.

## Roadmap toward “completed” store bundles

1. **Done:** Flutter scaffold, arm64 macOS + Android + iOS build scripts, download UX
2. **Done:** In-app WebView shell, OAuth via system browser, deep links
3. **Done:** Push token registration API + client hook (APNs/FCM plugin wiring next)
4. **Next:** Signed TestFlight + Play internal track + notarized macOS zip
5. **Then:** Store listings, privacy nutrition labels, production `BEVEL_BASE_URL`
