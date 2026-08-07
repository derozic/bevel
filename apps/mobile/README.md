# BEVEL mobile & desktop (Flutter)

Native client for **iOS**, **Android**, and **macOS Apple Silicon**.

## Quick start

```bash
cd apps/mobile
flutter pub get
# Live production (default)
flutter run -d macos
# or: pnpm mobile:run:macos

# Local Caddy only when you need it
pnpm mobile:run:macos:local
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
# Local (default .lvh.me)
./scripts/mobile/release.sh macos

# Production Silicon app → bevel.is / bevel.2x4m.cc
BEVEL_ENV=production ./scripts/mobile/release.sh macos

./scripts/mobile/release.sh android   # APK + AAB
./scripts/mobile/release.sh ios       # unsigned .app
./scripts/mobile/release.sh           # all of the above
```

Artifacts: `dist/native/<version>/BEVEL-macos-arm64.app` (+ zip).

See [docs/NATIVE_RELEASE.md](../../docs/NATIVE_RELEASE.md).

## Configuration

| Define | Local default | Production (`BEVEL_ENV=production`) |
|--------|---------------|-------------------------------------|
| `BEVEL_BASE_URL` | `https://bevel.is` | platform entry / login |
| `BEVEL_WORKSPACE_URL` | `https://bevel.2x4m.cc` | chat shell |
| `BEVEL_API_URL` | `https://api.bevel.is` | control plane (always live by default) |

Override to local Caddy with `BEVEL_ENV=local` or `pnpm mobile:run:macos:local`.

First login uses system browser Google OAuth → `/api/auth/native-complete` mints a
one-time handoff code → `bevel://auth/complete?code=…` → the in-app WebView redeems
`/api/auth/handoff` on the **workspace host** so Auth.js cookies land in the WebView
jar (Safari cookies are never shared with WKWebView).

## Version

`pubspec.yaml` → `0.4.0+5` (name + build). Bump for each store submission.

## Consumer product surface

The app is a **chat client**, not a full console:

| In app | Web only |
|--------|----------|
| Google sign-in + session handoff | `/console/*` settings, API keys |
| Channels, timeline, agents (FleetChat in WebView) | Slack / integrations admin |
| Notification prefs, escalations | Workflows, docs, status board |
| Share, deep links, push hooks | Operator tooling |

Signed-in users auto-resume the last channel. Phone uses a channel sheet; tablets use a dual-pane rail.

## Developer portal checklist

1. Apple: enable **HealthKit**, **Push Notifications**, Associated Domains on the App ID  
2. Google Play: declare Health Connect permissions in Play Console  
3. Host `apple-app-site-association` + Digital Asset Links for production hosts
