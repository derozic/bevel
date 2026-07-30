# Native push (FCM + APNs)

BEVEL uses **Firebase Cloud Messaging** for Android and for iOS/macOS APNs delivery
(FCM token that maps to APNs). Tokens register at:

`POST /api/v1/devices/push-tokens`

## 1Password items

| Item title | Contents |
|------------|----------|
| **BEVEL Firebase** | Project id, `google-services.json` (Android), `GoogleService-Info.plist` (iOS), service account JSON for server fan-out |
| **BEVEL APNs Key** | `.p8` key, Key ID, Team ID (also uploaded to Firebase Console → Cloud Messaging → Apple) |

Never commit real plist/json. Examples only:

- `apps/mobile/ios/Runner/GoogleService-Info.plist.example`
- `apps/mobile/android/app/google-services.json.example`

## Local / CI setup

```bash
# From 1Password (or secrets manager)
op read "op://dev/BEVEL Firebase/google-services.json" \
  > apps/mobile/android/app/google-services.json
op read "op://dev/BEVEL Firebase/GoogleService-Info.plist" \
  > apps/mobile/ios/Runner/GoogleService-Info.plist
```

Android Gradle applies the Google Services plugin **only if**
`google-services.json` exists (debug builds without Firebase still compile).

## Client flow

1. User grants notification permission (staged after first workspace open).
2. `PushBootstrap.ensureInitialized()` → `Firebase.initializeApp()`.
3. `FirebaseMessaging.getToken()` → `PushRegistrationService.registerToken`.
4. Token refresh stream re-registers automatically when bootstrap succeeds.

Without config files, the app still runs; only remote push is skipped.

## Server fan-out (follow-up)

With tokens in Postgres, a worker uses the Firebase Admin SDK / HTTP v1 with the
service account to send:

- Normal: `bevel_workspace` data messages
- Escalations (`^handle`): high priority / Android channel `bevel_escalation`

Env on API host (later): `FIREBASE_SERVICE_ACCOUNT_JSON` or path to JSON.
