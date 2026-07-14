# BEVEL native integrations (iOS · Android · macOS)

Deep platform APIs — not a thin WebView wrapper. The Flutter client at `apps/mobile` owns **sharing**, **Health**, **notifications**, **deep links**, and **icon / HIG standards**.

## Architecture

```
lib/native/
  native_capabilities.dart   # probe OS + feature matrix
  sharing_service.dart       # share_plus → system share sheet
  health_service.dart        # HealthKit + Health Connect
  notification_service.dart  # local alerts; APNs/FCM extension points
  deep_links.dart            # bevel:// + https app links
lib/ui/native_hub_page.dart  # operator / QA surface for integrations
```

| Capability | iOS | Android | macOS Silicon |
|------------|-----|---------|---------------|
| System share | UIActivityViewController | `ACTION_SEND` | Share services |
| Health read/write | **HealthKit** | **Health Connect** | — (future) |
| Notifications | UNUserNotification + APNs hook | channels + FCM hook | local |
| Deep links | Universal Links + `bevel://` | App Links + `bevel://` | custom URL |
| Icons | Icon Composer layered set | Adaptive + mono | dock icons |

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

## CallKit / ConnectionService (voice health calls)

Scaffold: `lib/native/call_service.dart` (`StubCallService` until product ships).

| Platform | System API | Next package |
|----------|------------|--------------|
| iOS | CallKit + PushKit | `flutter_callkit_incoming` |
| Android | ConnectionService / Telecom | same / platform channel |
| Signaling | BEVEL realtime invite → ring → answer | WebRTC (`@bevel/feature-webrtc`) |

Do not request CallKit entitlements until the signaling path is production-ready.

## Deep links

| Scheme | Example | Route |
|--------|---------|--------|
| Custom | `bevel://channel/product` | `/bevel/product` |
| HTTPS | `https://app.bevel.com/bevel/...` | path passthrough |

Configure Associated Domains (iOS) and Digital Asset Links (Android) for production hosts before store review.

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
- [ ] Adaptive icon + monochrome look correct on Pixel / iPhone  
- [ ] Icon Composer export still legible at 29pt  

## Related

- [NATIVE_RELEASE.md](./NATIVE_RELEASE.md) — build bundles  
- Download page: `/download` on the web app  
