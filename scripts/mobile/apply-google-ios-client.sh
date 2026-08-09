#!/usr/bin/env bash
# Wire an iOS-type Google OAuth client into the Flutter app.
#
# Create the client first:
#   https://console.cloud.google.com/apis/credentials?project=x4m-493516
#   Create credentials → OAuth client ID → Application type: iOS
#   Bundle ID: com.derozic.bevel.bevelApp
#
# Then:
#   ./scripts/mobile/apply-google-ios-client.sh 336973686985-XXXX.apps.googleusercontent.com
#
# Rebuild/run with:
#   flutter run -d <device> \
#     --dart-define=GOOGLE_IOS_CLIENT_ID=336973686985-XXXX.apps.googleusercontent.com \
#     --dart-define=GOOGLE_SERVER_CLIENT_ID=336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLIENT="${1:-}"
if [[ -z "$CLIENT" || "$CLIENT" != *.apps.googleusercontent.com ]]; then
  echo "Usage: $0 <ios-client-id>.apps.googleusercontent.com"
  echo ""
  echo "Error you hit:"
  echo "  Custom scheme URIs are not allowed for 'WEB' client type"
  echo "Means we used the web OAuth client for native Sign-In — need type iOS."
  exit 2
fi

# reversed: 336973686985-abc.apps.googleusercontent.com
# → com.googleusercontent.apps.336973686985-abc
PREFIX="${CLIENT%.apps.googleusercontent.com}"
REVERSED="com.googleusercontent.apps.${PREFIX}"

INFO="$ROOT/apps/mobile/ios/Runner/Info.plist"
GSERV="$ROOT/apps/mobile/ios/Runner/GoogleService-Info.plist"

# Info.plist URL scheme + GIDClientID
# Replace placeholder or existing google-sign-in scheme
python3 - "$INFO" "$CLIENT" "$REVERSED" <<'PY'
import sys, re
path, client, reversed_id = sys.argv[1:4]
text = open(path).read()
# set URL scheme inside google-sign-in dict
text = re.sub(
    r'(google-sign-in</string>\s*<key>CFBundleURLSchemes</key>\s*<array>\s*<string>)[^<]*',
    r'\1' + reversed_id,
    text,
)
# ensure GIDClientID
if 'GIDClientID' in text:
    text = re.sub(
        r'(<key>GIDClientID</key>\s*<string>)[^<]*',
        r'\1' + client,
        text,
    )
else:
    text = text.replace(
        '<key>GIDServerClientID</key>',
        f'<key>GIDClientID</key>\n\t<string>{client}</string>\n\t<key>GIDServerClientID</key>',
    )
# remove broken $(GOOGLE_REVERSED_CLIENT_ID) if still present
text = text.replace('$(GOOGLE_REVERSED_CLIENT_ID)', reversed_id)
open(path, 'w').write(text)
print('updated', path)
print('  GIDClientID', client)
print('  URL scheme', reversed_id)
PY

# GoogleService-Info.plist CLIENT_ID + REVERSED
if [[ -f "$GSERV" ]]; then
  python3 - "$GSERV" "$CLIENT" "$REVERSED" <<'PY'
import sys, re
path, client, reversed_id = sys.argv[1:4]
text = open(path).read()
for key, val in [('CLIENT_ID', client), ('REVERSED_CLIENT_ID', reversed_id)]:
    if f'<key>{key}</key>' in text:
        text = re.sub(
            rf'(<key>{key}</key>\s*<string>)[^<]*',
            r'\1' + val,
            text,
        )
    else:
        text = text.replace(
            '</dict>\n</plist>',
            f'\t<key>{key}</key>\n\t<string>{val}</string>\n</dict>\n</plist>',
        )
open(path, 'w').write(text)
print('updated', path)
PY
fi

# Persist for future builds
ENVF="$ROOT/apps/mobile/.env.google"
cat >"$ENVF" <<EOF
GOOGLE_IOS_CLIENT_ID=$CLIENT
GOOGLE_SERVER_CLIENT_ID=336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com
GOOGLE_REVERSED_CLIENT_ID=$REVERSED
EOF
echo "wrote $ENVF (gitignored recommended)"

echo ""
echo "Rebuild and install:"
echo "  cd apps/mobile && flutter run -d <iphone> \\"
echo "    --dart-define=GOOGLE_IOS_CLIENT_ID=$CLIENT \\"
echo "    --dart-define=GOOGLE_SERVER_CLIENT_ID=336973686985-0ggvfg30mh3junprhcfmdgdtepbnqfb0.apps.googleusercontent.com"
