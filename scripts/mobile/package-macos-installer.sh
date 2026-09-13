#!/usr/bin/env bash
# Package the signed Silicon .app as a Developer ID Installer PKG + DMG
# and write the full release manifest (JSON, text, iOS OTA plist).
#
# Usage:
#   ./scripts/mobile/package-macos-installer.sh
#   OUT=dist/native/1.0.0 APP=... ./scripts/mobile/package-macos-installer.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
VERSION="$(grep -E '^version:' "$MOBILE/pubspec.yaml" | awk '{print $2}' | cut -d+ -f1)"
BUILD="$(grep -E '^version:' "$MOBILE/pubspec.yaml" | awk '{print $2}' | cut -d+ -f2)"
OUT="${OUT:-$ROOT/dist/native/$VERSION}"
APP="${APP:-$OUT/BEVEL-macos-arm64.app}"
INSTALLER_ID="${BEVEL_INSTALLER_IDENTITY:-Developer ID Installer: Earthena, Inc. (8A36CUVEDS)}"
APP_ID="${BEVEL_CODESIGN_IDENTITY:-Developer ID Application: Earthena, Inc. (8A36CUVEDS)}"
BUNDLE_ID="com.derozic.bevel.bevelApp"
SCRIPTS="$ROOT/scripts/mobile/macos-installer"
ICON="$MOBILE/design/icon/bevel-icon-1024.png"

if [[ ! -d "$APP" ]]; then
  echo "ERROR: signed app not found: $APP"
  echo "       run ./scripts/mobile/release.sh macos first"
  exit 1
fi

mkdir -p "$OUT"
chmod +x "$SCRIPTS/preinstall" "$SCRIPTS/postinstall"

echo "==> installer package from $APP"

# --- DMG (drag-to-Applications fallback) ------------------------------------
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

mkdir -p "$WORK/dmg"
ditto --norsrc --noextattr --noqtn "$APP" "$WORK/dmg/BEVEL.app"
ln -s /Applications "$WORK/dmg/Applications"
DMG="$OUT/BEVEL-macos-arm64.dmg"
rm -f "$DMG"
hdiutil create -volname "BEVEL $VERSION" -srcfolder "$WORK/dmg" -ov \
  -format UDZO -imagekey zlib-level=9 "$DMG" >/dev/null
codesign --force --sign "$APP_ID" --timestamp "$DMG" 2>/dev/null \
  || codesign --force --sign "$APP_ID" "$DMG"
echo "    dmg: $DMG"

# --- component + product PKG ------------------------------------------------
mkdir -p "$WORK/root" "$WORK/scripts"
ditto --norsrc --noextattr --noqtn "$APP" "$WORK/root/BEVEL.app"
cp "$SCRIPTS/preinstall" "$SCRIPTS/postinstall" "$WORK/scripts/"
chmod +x "$WORK/scripts/preinstall" "$WORK/scripts/postinstall"
COMPONENT="$WORK/BEVEL-component.pkg"
pkgbuild \
  --root "$WORK/root" \
  --identifier "$BUNDLE_ID" \
  --version "$VERSION" \
  --install-location /Applications \
  --min-os-version 11.0 \
  --scripts "$WORK/scripts" \
  --ownership recommended \
  "$COMPONENT"

sign_pkg() {
  local src="$1" dest="$2"
  local i
  for i in 1 2 3; do
    if caffeinate -i productsign --sign "$INSTALLER_ID" --timestamp "$src" "$dest"; then
      return 0
    fi
    echo "    productsign retry $i"
    sleep 3
  done
  echo "    timestamp still down — signing installer without timestamp"
  caffeinate -i productsign --sign "$INSTALLER_ID" "$src" "$dest"
}

productbuild --synthesize --package "$COMPONENT" "$WORK/Distribution.xml" >/dev/null

/usr/bin/python3 - "$WORK/Distribution.xml" "$VERSION" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
version = sys.argv[2]
xml = path.read_text()
inject = f'''    <title>BEVEL {version}</title>
    <organization>com.derozic</organization>
    <domains enable_anywhere="false" enable_currentUserHome="false" enable_localSystem="true"/>
    <options customize="never" require-scripts="false" hostArchitectures="arm64" rootVolumeOnly="true"/>
    <welcome file="welcome.html" mime-type="text/html"/>
    <conclusion file="conclusion.html" mime-type="text/html"/>
    <volume-check>
        <allowed-os-versions>
            <os-version min="11.0"/>
        </allowed-os-versions>
    </volume-check>
'''
# Insert after <installer-gui-script ...>
needle = xml.find('>')
if needle == -1:
    raise SystemExit('Distribution.xml missing root')
# First tag close
end = xml.find('>', xml.find('<installer-gui-script'))
xml = xml[: end + 1] + '\n' + inject + xml[end + 1 :]
path.write_text(xml)
PY

mkdir -p "$WORK/resources"
cp "$SCRIPTS/welcome.html" "$SCRIPTS/conclusion.html" "$WORK/resources/"

UNSIGNED_PKG="$WORK/BEVEL-unsigned.pkg"
productbuild \
  --distribution "$WORK/Distribution.xml" \
  --package-path "$WORK" \
  --resources "$WORK/resources" \
  "$UNSIGNED_PKG"
PKG="$OUT/BEVEL-macos-arm64.pkg"
rm -f "$PKG"
sign_pkg "$UNSIGNED_PKG" "$PKG"
pkgutil --check-signature "$PKG" | sed 's/^/    /'
echo "    pkg: $PKG"

# --- iOS OTA display images + plist -----------------------------------------
OTA57="$OUT/ota-icon-57.png"
OTA512="$OUT/ota-icon-512.png"
if [[ -f "$ICON" ]]; then
  sips -z 57 57 "$ICON" --out "$OTA57" >/dev/null
  sips -z 512 512 "$ICON" --out "$OTA512" >/dev/null
fi

IPA_CANDIDATES=(
  "$OUT/BEVEL.ipa"
  "$ROOT/apps/web/public/downloads/BEVEL.ipa"
)
IPA=""
for c in "${IPA_CANDIDATES[@]}"; do
  if [[ -f "$c" ]]; then IPA="$c"; break; fi
done

/usr/bin/python3 - "$ROOT" "$OUT" "$VERSION" "$BUILD" "$APP" "$PKG" "$DMG" "$IPA" "$BUNDLE_ID" <<'PY'
import hashlib, json, os, plistlib, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

root, out, version, build, app, pkg, dmg, ipa, bundle_id = sys.argv[1:]
out = Path(out)
app = Path(app)

def sha256(p: Path):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def md5(p: Path):
    h = hashlib.md5()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def artifact(path: Path, url_name: str, content_type: str):
    if not path.is_file():
        return None
    return {
        'file': path.name,
        'url': f'https://bevel.is/downloads/{url_name}',
        'sha256': sha256(path),
        'md5': md5(path),
        'size': path.stat().st_size,
        'content_type': content_type,
    }

def run(cmd, stderr=subprocess.STDOUT):
    return subprocess.check_output(cmd, text=True, stderr=stderr)

plist_raw = run(['plutil', '-convert', 'json', '-o', '-', str(app / 'Contents/Info.plist')], stderr=subprocess.DEVNULL)
info = json.loads(plist_raw)

codesign = run(['codesign', '-dv', '--verbose=2', str(app)])
ent_xml = subprocess.check_output(
    ['codesign', '-d', '--entitlements', ':-', str(app)],
    stderr=subprocess.DEVNULL,
)
start = ent_xml.find(b'<?xml')
ents = plistlib.loads(ent_xml[start:]) if start != -1 else {}
entitlements = [{'key': k, 'value': v} for k, v in ents.items()] if isinstance(ents, dict) else []

timestamp = None
team = None
runtime = False
for line in codesign.splitlines():
    if line.startswith('Timestamp='):
        timestamp = line.split('=', 1)[1].strip()
    if line.startswith('TeamIdentifier='):
        team = line.split('=', 1)[1].strip()
    if 'flags=' in line and 'runtime' in line:
        runtime = True

try:
    git_commit = run(['git', '-C', root, 'rev-parse', 'HEAD']).strip()
    git_branch = run(['git', '-C', root, 'rev-parse', '--abbrev-ref', 'HEAD']).strip()
except Exception:
    git_commit = git_branch = None

components = []
macos_dir = app / 'Contents/MacOS'
fw_dir = app / 'Contents/Frameworks'
if macos_dir.is_dir():
    for p in sorted(macos_dir.iterdir()):
        if p.is_file():
            components.append({
                'path': str(p.relative_to(app)),
                'kind': 'executable',
                'size': p.stat().st_size,
            })
if fw_dir.is_dir():
    for p in sorted(fw_dir.iterdir()):
        name = p.name
        components.append({
            'path': f'Contents/Frameworks/{name}',
            'kind': 'framework' if name.endswith('.framework') else 'dylib',
            'size': sum(f.stat().st_size for f in p.rglob('*') if f.is_file()) if p.is_dir() else p.stat().st_size,
        })

zip_path = out / 'BEVEL-macos-arm64.zip'
if not zip_path.is_file() and app.is_dir():
    # keep existing zip if present
    pass

apk_candidates = [
    out / 'BEVEL-android.apk',
    out / 'BEVEL-android-release.apk',
    Path(root) / 'apps/web/public/downloads/BEVEL-android.apk',
]
apk = next((p for p in apk_candidates if p.is_file()), None)
ipa_path = Path(ipa) if ipa and Path(ipa).is_file() else None

notarized = False
try:
    sp = run(['spctl', '-a', '-vv', str(app)])
    notarized = 'source=Notarized Developer ID' in sp or 'Notarized' in sp
except Exception:
    sp = ''

macos_artifacts = {
    'pkg': artifact(Path(pkg), 'BEVEL-macos-arm64.pkg', 'application/octet-stream'),
    'dmg': artifact(Path(dmg), 'BEVEL-macos-arm64.dmg', 'application/x-apple-diskimage'),
    'zip': artifact(zip_path, 'BEVEL-macos-arm64.zip', 'application/zip') if zip_path.is_file() else None,
}

manifest = {
    'schema': 'bevel.release-manifest/1',
    'product': 'BEVEL',
    'publisher': 'Earthena, Inc.',
    'team_id': team or '8A36CUVEDS',
    'copyright': info.get('NSHumanReadableCopyright'),
    'version': version,
    'build': str(build),
    'released_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'git': {'commit': git_commit, 'branch': git_branch},
    'hosts': {
        'base': 'https://bevel.is',
        'api': 'https://api.bevel.is',
        'workspace': 'https://bevel.2x4m.cc',
        'download': 'https://bevel.is/download',
        'releases': 'https://github.com/derozic/bevel/releases/tag/v' + version,
    },
    'macos': {
        'arch': 'arm64',
        'min_os': info.get('LSMinimumSystemVersion', '11.0'),
        'bundle_id': info.get('CFBundleIdentifier', bundle_id),
        'bundle_name': info.get('CFBundleName', 'BEVEL'),
        'url_scheme': 'bevel',
        'install_location': '/Applications/BEVEL.app',
        'category': info.get('LSApplicationCategoryType'),
        'codesign': {
            'identity': 'Developer ID Application: Earthena, Inc. (8A36CUVEDS)',
            'team_id': team or '8A36CUVEDS',
            'hardened_runtime': runtime,
            'timestamp': timestamp,
            'notarized': notarized,
        },
        'installer': {
            'identity': 'Developer ID Installer: Earthena, Inc. (8A36CUVEDS)',
            'installs_to': '/Applications/BEVEL.app',
            'requires_admin': True,
            'host_architectures': ['arm64'],
        },
        'entitlements': entitlements,
        'artifacts': {k: v for k, v in macos_artifacts.items() if v},
        'components': components,
    },
}

if ipa_path:
    manifest['ios'] = {
        'bundle_id': bundle_id,
        'min_os': '16.0',
        'ota_manifest': 'https://bevel.is/downloads/manifest.plist',
        'artifacts': {
            'ipa': artifact(ipa_path, 'BEVEL.ipa', 'application/octet-stream'),
        },
        'note': 'Ad-hoc / registered devices until TestFlight.',
    }
if apk:
    manifest['android'] = {
        'artifacts': {
            'apk': artifact(apk, 'BEVEL-android.apk', 'application/vnd.android.package-archive'),
        },
        'note': 'Sideload until Play track.',
    }

json_path = out / 'manifest.json'
json_path.write_text(json.dumps(manifest, indent=2) + '\n')

lines = [
    f"BEVEL {version} ({build}) release manifest",
    f"publisher: Earthena, Inc.  team {team or '8A36CUVEDS'}",
    f"released: {manifest['released_at']}",
    f"git: {git_branch} {git_commit}",
    f"hosts: {manifest['hosts']['base']}  {manifest['hosts']['api']}  {manifest['hosts']['workspace']}",
    '',
    'macOS Apple Silicon — professional install',
    f"  bundle: {manifest['macos']['bundle_id']}",
    f"  min os: {manifest['macos']['min_os']}",
    f"  install location: /Applications/BEVEL.app",
    f"  url scheme: bevel://",
    f"  application identity: {manifest['macos']['codesign']['identity']}",
    f"  installer identity: {manifest['macos']['installer']['identity']}",
    f"  hardened runtime: {runtime}  notarized: {notarized}  timestamp: {timestamp}",
    '  entitlements:',
]
for e in entitlements:
    lines.append(f"    {e['key']}={e['value']}")
lines.append('  artifacts:')
for name, art in manifest['macos']['artifacts'].items():
    lines.append(f"    {name}: {art['file']}  {art['size']} bytes")
    lines.append(f"      sha256 {art['sha256']}")
    lines.append(f"      {art['url']}")
lines.append('  components:')
for c in components:
    lines.append(f"    {c['path']}  {c['kind']}  {c['size']}")
if 'ios' in manifest:
    lines += ['', 'iOS']
    ipa_art = manifest['ios']['artifacts']['ipa']
    lines.append(f"  {ipa_art['file']}  {ipa_art['size']} bytes  sha256 {ipa_art['sha256']}")
    lines.append(f"  ota: {manifest['ios']['ota_manifest']}")
if 'android' in manifest:
    lines += ['', 'Android']
    apk_art = manifest['android']['artifacts']['apk']
    lines.append(f"  {apk_art['file']}  {apk_art['size']} bytes  sha256 {apk_art['sha256']}")
lines.append('')
(out / 'MANIFEST.txt').write_text('\n'.join(lines) + '\n')

# iOS OTA plist (itms-services)
ota = {
    'items': [{
        'assets': [
            {
                'kind': 'software-package',
                'url': 'https://bevel.is/downloads/BEVEL.ipa',
                **({'md5': md5(ipa_path)} if ipa_path else {}),
            },
            {
                'kind': 'display-image',
                'needs-shine': False,
                'url': 'https://bevel.is/downloads/ota-icon-57.png',
            },
            {
                'kind': 'full-size-image',
                'needs-shine': False,
                'url': 'https://bevel.is/downloads/ota-icon-512.png',
            },
        ],
        'metadata': {
            'bundle-identifier': bundle_id,
            'bundle-version': version,
            'kind': 'software',
            'title': 'BEVEL',
            'subtitle': f'{version} ({build})',
        },
    }]
}
with (out / 'manifest.plist').open('wb') as f:
    plistlib.dump(ota, f, sort_keys=False)

print(f"    manifest: {json_path}")
print(f"    text:     {out / 'MANIFEST.txt'}")
print(f"    ota:      {out / 'manifest.plist'}")
PY

echo "==> packaged"
ls -lh "$PKG" "$DMG" "$OUT/manifest.json" "$OUT/MANIFEST.txt"
