#!/usr/bin/env bash
# Pull Bevel Apple Sign In from 1Password into local dotenv files.
#
#   ./scripts/setup-apple-signin.sh
#
# Does not print secret values. Requires item "Bevel Apple Sign In" in vault dev
# with APPLE_KEY_ID + APPLE_PRIVATE_KEY after the .p8 is downloaded.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OP_VAULT="${BEVEL_OP_VAULT:-dev}"
OP_ITEM="${BEVEL_APPLE_OP_ITEM:-Bevel Apple Sign In}"

dotenv_set() {
  local file="$1" key="$2" value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
import pathlib, re, sys
path, key, value = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
text = path.read_text() if path.exists() else ""
escaped = value.replace("\\", "\\\\").replace('"', '\\"')
line = f'{key}="{escaped}"'
pat = re.compile(rf'^[ \t]*#?[ \t]*{re.escape(key)}=.*$', re.M)
if pat.search(text):
    text = pat.sub(line, text, count=1)
else:
    if text and not text.endswith("\n"):
        text += "\n"
    text += line + "\n"
path.write_text(text)
print(f"set {key} in {path} (len={len(value)})")
PY
}

field() {
  local label="$1"
  op item get "$OP_ITEM" --vault "$OP_VAULT" --fields "label=$label" --reveal 2>/dev/null || true
}

echo "==> 1Password $OP_VAULT / $OP_ITEM"
client="$(field APPLE_CLIENT_ID)"
app="$(field APPLE_APP_ID)"
team="$(field APPLE_TEAM_ID)"
key_id="$(field APPLE_KEY_ID)"
pem="$(field APPLE_PRIVATE_KEY)"
callback="$(field APPLE_CALLBACK_URL)"

[[ -n "$client" ]] || client="com.derozic.bevel.web"
[[ -n "$app" ]] || app="com.derozic.bevel.bevelApp"
[[ -n "$team" ]] || team="8A36CUVEDS"
[[ -n "$callback" ]] || callback="https://bevel.lvh.me/auth/apple/callback"

for envf in "$ROOT/.env" "$ROOT/apps/web/.env.local"; do
  dotenv_set "$envf" APPLE_CLIENT_ID "$client"
  dotenv_set "$envf" APPLE_APP_ID "$app"
  dotenv_set "$envf" APPLE_TEAM_ID "$team"
  dotenv_set "$envf" APPLE_CALLBACK_URL "$callback"
  if [[ -n "$key_id" ]]; then
    dotenv_set "$envf" APPLE_KEY_ID "$key_id"
  fi
  if [[ -n "$pem" ]]; then
    dotenv_set "$envf" APPLE_PRIVATE_KEY "$pem"
  fi
done

if [[ -z "$key_id" || -z "$pem" ]]; then
  echo "WARN: APPLE_KEY_ID / APPLE_PRIVATE_KEY missing — download the .p8 from"
  echo "      https://developer.apple.com/account/resources/authkeys/list"
  echo "      then: op item edit \"$OP_ITEM\" --vault $OP_VAULT APPLE_KEY_ID=… APPLE_PRIVATE_KEY=…"
  exit 2
fi
echo "OK: Apple env written. Restart web so Next.js picks up APPLE_*."
