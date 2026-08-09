# Native Google Sign-In (iOS / Android)

## Error: Custom scheme URIs are not allowed for 'WEB' client type

Google Sign-In on iOS uses a **custom URL scheme**
(`com.googleusercontent.apps.<client-id-prefix>:/…`).

That only works with an OAuth client of type **iOS**.  
A **WEB** client (our Auth.js `AUTH_GOOGLE_ID`) will fail with Error 400.

| Role | Client type | Example use |
|------|-------------|-------------|
| `serverClientId` / `GIDServerClientID` | **WEB** | ID token audience for API verify |
| `clientId` / `GIDClientID` + URL scheme | **iOS** | Native account picker on iPhone |
| Android client | **Android** | package + SHA-1 |

## Create iOS client (2 minutes)

1. Open [Credentials — project 2x4m](https://console.cloud.google.com/apis/credentials?project=x4m-493516)
2. **+ Create credentials → OAuth client ID**
3. Application type: **iOS**
4. Name: `BEVEL iOS`
5. Bundle ID: `com.derozic.bevel.bevelApp`
6. Create → copy the client ID (`….apps.googleusercontent.com`)

## Apply + rebuild

```bash
./scripts/mobile/apply-google-ios-client.sh PASTE_CLIENT_ID_HERE.apps.googleusercontent.com

cd apps/mobile
flutter run -d <iphone> \
  --dart-define=GOOGLE_IOS_CLIENT_ID=PASTE_CLIENT_ID_HERE.apps.googleusercontent.com \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com \
  --dart-define=BEVEL_BASE_URL=https://bevel.is \
  --dart-define=BEVEL_API_URL=https://api.bevel.is \
  --dart-define=BEVEL_WORKSPACE_URL=https://bevel.2x4m.cc
```

## Android (Fold)

1. Same credentials page → OAuth client type **Android**
2. Package: `com.derozic.bevel.bevel_app`
3. SHA-1: debug `A7:04:8E:49:06:82:E3:BA:4C:EB:43:10:FC:0D:5F:BE:30:60:B5:E0`  
   (release SHA-1 from Play upload keystore when shipping)
4. Rebuild with `--dart-define=GOOGLE_ANDROID_CLIENT_ID=…` if not using google-services.json alone

## Server

`POST /api/v1/auth/google-native` verifies the ID token against `AUTH_GOOGLE_ID`
(and optional `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_NATIVE_CLIENT_IDS`).
