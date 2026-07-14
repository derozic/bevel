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
5. **Extension points** for APNs device token + FCM — register with BEVEL API when push backend lands

Background modes (iOS): `remote-notification`, `fetch`.

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
