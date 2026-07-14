# BEVEL mobile & desktop (Flutter)

Native client for **iOS**, **Android**, and **macOS Apple Silicon**.

## Quick start

```bash
cd apps/mobile
flutter pub get
flutter run -d macos --dart-define=BEVEL_BASE_URL=https://2x4m.bevel.lvh.me
# Device: flutter run -d <ios|android device id>
```

## Native integrations (iOS · Android)

Deep OS APIs — not a thin browser shell:

| Area | iOS | Android |
|------|-----|---------|
| Share | UIActivityViewController | `ACTION_SEND` + share target |
| Health | **HealthKit** | **Health Connect** |
| Notifications | Local + APNs hook | Channels + FCM hook |
| Links | Universal Links + `bevel://` | App Links + `bevel://` |
| Icons | Icon Composer layered mark | Adaptive + monochrome |

In-app QA surface: **Native integrations** on the home screen.

Docs: [docs/NATIVE_INTEGRATIONS.md](../../docs/NATIVE_INTEGRATIONS.md)  
Icons: [design/icon/README.md](design/icon/README.md)

```bash
# Regenerate store icons from design/icon masters
dart run flutter_launcher_icons
```

## Release bundles

From the monorepo root:

```bash
./scripts/mobile/release.sh macos     # arm64 .app + zip
./scripts/mobile/release.sh android   # APK + AAB
./scripts/mobile/release.sh ios       # unsigned .app
./scripts/mobile/release.sh           # all of the above
```

See [docs/NATIVE_RELEASE.md](../../docs/NATIVE_RELEASE.md).

## Configuration

| Define | Default | Purpose |
|--------|---------|---------|
| `BEVEL_BASE_URL` | `https://2x4m.bevel.lvh.me` | Workspace origin opened by the client |

## Version

`pubspec.yaml` → `0.1.0+1` (name + build). Bump for each store submission.

## Developer portal checklist

1. Apple: enable **HealthKit**, **Push Notifications**, Associated Domains on the App ID  
2. Google Play: declare Health Connect permissions in Play Console  
3. Host `apple-app-site-association` + Digital Asset Links for production hosts
