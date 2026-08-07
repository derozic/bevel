# Native push (FCM + APNs)

BEVEL uses **Firebase Cloud Messaging** for Android and for iOS/macOS APNs delivery
(FCM token that maps to APNs).

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/devices/push-tokens` | public | Register / refresh device token |
| `GET` | `/api/v1/devices/push-tokens` | fleet internal | List tokens |
| `DELETE` | `/api/v1/devices/push-tokens/{token}` | fleet internal | Unregister |
| `POST` | `/api/v1/devices/push-send` | fleet internal | Test fan-out |
| `GET` | `/api/v1/devices/push-status` | fleet internal | Is FCM service account loaded? |

Automatic fan-out (no extra call):

- `^handle` escalations → high-priority FCM (`bevel_escalation` channel)
- `@handle` soft mentions → normal FCM (`bevel_workspace`)

Both attach `deepLink` / `payload` like `bevel://channel/{slug}` for native open.

## 1Password items

| Item title | Contents |
|------------|----------|
| **BEVEL Firebase** | `google-services.json`, `GoogleService-Info.plist`, `service-account.json`, `project_id` |
| **BEVEL APNs Key** | `.p8` key, Key ID, Team ID (also upload to Firebase → Cloud Messaging → Apple) |

Never commit real plist/json. Examples only:

- `apps/mobile/ios/Runner/GoogleService-Info.plist.example`
- `apps/mobile/android/app/google-services.json.example`

## Pull client + server secrets

```bash
./scripts/mobile/pull-firebase-config.sh
# → apps/mobile/android/app/google-services.json
# → apps/mobile/ios/Runner/GoogleService-Info.plist
# → secrets/firebase-service-account.json  (gitignored)
```

If the 1Password item is missing, the script prints Firebase Console + `op item create` steps.

## API host env (production)

On the EC2 / API process:

```bash
# Prefer path on the host (file mode 0600, owned by deploy)
export FIREBASE_SERVICE_ACCOUNT_PATH=/opt/bevel/secrets/firebase-service-account.json
# or inline JSON
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
# optional override
export FIREBASE_PROJECT_ID=your-firebase-project-id
```

`google-auth` mints short-lived tokens for FCM HTTP v1. When unset, message
writes still succeed; push results report `fcm_not_configured`.

## Client flow

1. User grants notification permission (staged after first workspace open).
2. `PushHandlers.install` → `Firebase.initializeApp()` + FCM listeners.
3. `FirebaseMessaging.getToken()` → `POST /api/v1/devices/push-tokens` with `userId`.
4. Session healthy / OAuth complete re-registers with identity for fan-out.
5. Token refresh stream re-registers automatically.
6. Foreground messages surface as local notifications; taps open deep links.

Without config files, the app still runs; only remote push is skipped.

## Test send

```bash
curl -sS -X POST https://api.bevel.is/api/v1/devices/push-send \
  -H "X-Fleet-Internal-Key: $FLEET_INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "title": "BEVEL QA",
    "body": "Tap to open ~general",
    "deepLink": "bevel://channel/general",
    "highPriority": true
  }'
```

## Android Gradle

`google-services` plugin applies **only if** `google-services.json` exists.
Release signing uses `android/key.properties` when present (Play upload keystore).
