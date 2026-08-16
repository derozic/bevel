# BEVEL native integrations (iOS · Android · macOS)

Deep platform APIs — not a thin WebView wrapper. The Flutter client at `apps/mobile` owns **sharing**, **Health**, **notifications**, **deep links**, **Hermes Desktop interop**, **optional iMessage / SMS hosts**, **media device discovery (audio huddles)**, and **icon / HIG standards**.

## Install dual-track (product decision)

| Path | Best for | Not enough for |
|------|----------|----------------|
| **Apple Silicon Flutter app** (recommended on Mac) | Computer integration, Hermes, stable mic/speaker discovery, audio huddles, native OAuth return | — |
| **Browser “Install app” (PWA)** | Light dock icon, web notifications, quick channel access | Reliable device discovery, CallKit-grade huddles, Hermes Desktop bridge |

**Rule:** ship features that need host audio/video or OS bridges **only** in the native app. Keep PWA as a convenience shell. Download page (`/download`) explains both paths.

## Architecture

```
lib/native/
  native_capabilities.dart   # probe OS + feature matrix
  sharing_service.dart       # share_plus → system share sheet
  health_service.dart        # HealthKit + Health Connect
  notification_service.dart  # local alerts; APNs/FCM extension points
  deep_links.dart            # bevel:// + https app links + hermes/*
  hermes_bridge.dart         # Hermes.app / CLI / gateway probe + launch
  hermes_handoff.dart        # v1 clipboard + deep-link payload
  media_device_discovery.dart  # mic/speaker/camera inventory (huddles)
  imessage_bridge.dart       # optional Messages.app host (macOS)
  sms_host_bridge.dart       # optional Android SMS host (Google Messages inbox)
  call_service.dart          # CallKit / ConnectionService scaffold
macos/Runner/
  MediaDeviceChannel.swift   # CoreAudio + AVFoundation enumeration
  IMessageChannel.swift      # chat.db + AppleScript (no BlueBubbles)
android/.../bevel_app/
  SmsHostChannel.kt          # telephony SMS send/read (not RCS)
lib/ui/native_hub_page.dart  # operator / QA surface for integrations
```

| Capability | iOS | Android | macOS Silicon |
|------------|-----|---------|---------------|
| System share | UIActivityViewController | `ACTION_SEND` | Share services |
| Health read/write | **HealthKit** | **Health Connect** | — (future) |
| Notifications | UNUserNotification + APNs hook | channels + FCM hook | local |
| Deep links | Universal Links + `bevel://` | App Links + `bevel://` | `bevel://` + Hermes return |
| Hermes Desktop | — | — | **Bridge + handoffs** |
| Device discovery (huddles) | planned | planned | **CoreAudio + AVFoundation** |
| Audio huddles | WebRTC later | WebRTC later | discovery first → WebRTC |
| iMessage host | — | — | **optional, chat.db + AppleScript** |
| SMS host (Google Messages inbox) | — | **optional, telephony SMS** | — |
| Icons | Icon Composer layered set | Adaptive + mono | dock icons |

Hermes details: [HERMES_DESKTOP.md](./HERMES_DESKTOP.md).

## Sharing

`SharingService` uses `share_plus` so invites, channel URLs, and agent transcript snippets open the **native** share sheet (Messages, Mail, Slack, AirDrop, Nearby Share, etc.).

Android also registers as a **share target** for `text/plain` (inbound share into BEVEL).

## Health (Apple HealthKit · Google Health Connect)

`HealthService` wraps the `health` plugin:

- **Read (default):** steps, heart rate, active energy, sleep, workouts  
- **Write (default):** workouts the user explicitly logs  
- **UX:** opt-in only via Native integrations hub; never silent scrape  
- **Product use:** optional presence/sentience context and wellness agents — **not** clinical diagnosis

### iOS

- Entitlements: `ios/Runner/Runner.entitlements` (`com.apple.developer.healthkit`, background delivery, push env, associated domains)
- Usage strings: `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`
- Enable **HealthKit** capability on the App ID in the Apple Developer portal

### Android

- Permissions: `android.permission.health.READ_*` / `WRITE_EXERCISE`
- Health Connect rationale activity + `health_permissions` array
- Requires Health Connect app / system APIs (API 26+)

## Notifications

`NotificationService`:

1. Creates Android channel `bevel_workspace`
2. Requests runtime notification permission
3. Shows local alerts (mentions, agent updates)
4. Schedules reminders (standups / votes)
5. Calls `syncPushToken()` → `PushRegistrationService` →  
   `POST /api/v1/devices/push-tokens` on the control plane

Background modes (iOS): `remote-notification`, `fetch`.

### APNs / FCM registration

| Layer | Status |
|-------|--------|
| API store | `POST /api/v1/devices/push-tokens` (public register) · list/delete require `X-Fleet-Internal-Key` |
| Flutter client | `lib/native/push_registration.dart` |
| Token source | `fetchPlatformDeviceToken()` returns null until `firebase_messaging` / APNs plugin is wired |

When Apple/Google push credentials land in 1Password:

1. Add `firebase_messaging` (Android/iOS) + APNs key upload to Firebase or direct APNs
2. Implement `PushRegistrationService.fetchPlatformDeviceToken`
3. Call `NotificationService.syncPushToken` after permission grant
4. Control-plane worker reads tokens and fans out via APNs/FCM HTTP v1

## OAuth (system browser)

Google blocks or degrades embedded WebViews. The client:

- Detects IdP / Auth.js sign-in URLs via `BevelConfig.isOAuthNavigation`
- Opens them with `OAuthBrowser` → `LaunchMode.externalApplication` (Safari / Chrome)
- Exposes **Sign in (system browser)** on home + workspace shell
- Accepts return deep link `bevel://auth/complete` to reload the workspace

See [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md) for Cloud Console redirect URIs.

## Media device discovery → audio huddles

**Prerequisite for huddles:** know which mic/speaker/camera the human intends to use.

Native Silicon path (`MediaDeviceDiscovery` + `MediaDeviceChannel.swift`):

1. Sandbox entitlements: `device.audio-input`, `device.camera`
2. Usage strings: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`
3. Enumerate: AVFoundation capture devices + CoreAudio inputs/outputs
4. Request access → re-scan for full labels
5. Feed preferred device ids into WebRTC join (`@bevel/feature-webrtc`)

QA: **Native integrations → Discover devices** on the Mac app.

Browser PWA can call `navigator.mediaDevices.enumerateDevices`, but labels are often empty until a prior `getUserMedia`, defaults are flaky across browser restarts, and there is no Hermes/CallKit bridge. Prefer Silicon for huddle-capable installs.

## CallKit / ConnectionService (voice health calls)

Scaffold: `lib/native/call_service.dart` (`StubCallService` until product ships).

| Platform | System API | Next package |
|----------|------------|--------------|
| iOS | CallKit + PushKit | `flutter_callkit_incoming` |
| Android | ConnectionService / Telecom | same / platform channel |
| macOS | device discovery + system audio | MediaDeviceChannel (done) → WebRTC |
| Signaling | BEVEL realtime invite → ring → answer | WebRTC (`@bevel/feature-webrtc`) |

Do not request CallKit entitlements until the signaling path is production-ready.

## Deep links

| Scheme | Example | Route |
|--------|---------|--------|
| Custom | `bevel://channel/product` | `/bevel/product` |
| Hermes open | `bevel://hermes/open?channel=product&mode=build` | channel + pending handoff |
| Hermes return | `bevel://hermes/return?channel=product&status=done` | toast + channel focus |
| Hermes status | `bevel://hermes/status` | Native Hub Hermes card |
| HTTPS | `https://app.bevel.com/bevel/...` | path passthrough |

Configure Associated Domains (iOS) and Digital Asset Links (Android) for production hosts before store review. macOS listens via `app_links` + `CFBundleURLSchemes` (`bevel`).

## Platform standards

- **Display name:** BEVEL  
- **Material 3** dark chrome with green accent (`#22C55E`)  
- **Safe areas**, edge-to-edge Android (`enableOnBackInvokedCallback`)  
- **Network:** cleartext disabled; user/system CAs for local Caddy  
- **Icons:** see `apps/mobile/design/icon/` + Icon Composer brief  

## Privacy

Health and notification strings must match real behavior. Document data use in App Store / Play privacy nutrition labels before release.

## QA checklist

- [ ] Share sheet opens with workspace URL  
- [ ] Health auth sheet (iOS Settings → Health / Android Health Connect)  
- [ ] Steps sample returns after grant  
- [ ] Notification permission + test alert  
- [ ] `bevel://channel/test` opens cold and warm  
- [ ] Hermes Probe + Open Hermes on macOS  
- [ ] iMessage Probe + Grant access + Test send (macOS, Full Disk Access + Automation)  
- [ ] SMS host Probe + Grant SMS + Enable + Test send + Scan life timeline (Android)  
- [ ] `bevel://hermes/status` focuses Hermes card  
- [ ] **Discover devices** lists mic/speaker/camera on Silicon  
- [ ] Adaptive icon + monochrome look correct on Pixel / iPhone  
- [ ] Icon Composer export still legible at 29pt  
- [ ] `/download` shows Silicon recommended + PWA secondary  

## Related

- [HERMES_DESKTOP.md](./HERMES_DESKTOP.md) — Hermes Desktop interop  
- [IMESSAGE.md](./IMESSAGE.md) — optional Mac iMessage host (replaces BlueBubbles)  
- [GOOGLE_MESSAGES.md](./GOOGLE_MESSAGES.md) — optional Android SMS host  
- [NATIVE_RELEASE.md](./NATIVE_RELEASE.md) — build bundles  
- Download page: `/download` on the web app  
