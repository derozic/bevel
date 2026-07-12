# BEVEL mobile & desktop (Flutter)

Native client for **iOS**, **Android**, and **macOS Apple Silicon**.

## Quick start

```bash
cd apps/mobile
flutter pub get
flutter run -d macos --dart-define=BEVEL_BASE_URL=https://2x4m.bevel.lvh.me
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
