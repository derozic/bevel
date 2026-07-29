#!/usr/bin/env bash
# Install / upgrade cheap same-box Synapse for BEVEL on Ubuntu EC2.
#
# Cost: $0 extra AWS — runs on bevel-prod (matrix.bevel.is already points here).
# RAM: MemoryMax=512M. Disk: media capped; needs ~400MB free for venv.
#
# Usage (on server as root or with sudo):
#   sudo bash /opt/bevel/scripts/install-matrix-synapse.sh
#   # or from laptop:
#   ssh bevel-prod 'sudo bash -s' < scripts/install-matrix-synapse.sh
#
# Idempotent: re-run safe; preserves tokens if already present.
set -euo pipefail

MATRIX_ROOT="${MATRIX_ROOT:-/opt/bevel/services/matrix}"
REPO_ROOT="${REPO_ROOT:-/opt/bevel}"
SERVER_NAME="${MATRIX_SERVER_NAME:-matrix.bevel.is}"
HS_URL_LOCAL="http://127.0.0.1:8008"
AS_URL="${MATRIX_AS_URL:-http://127.0.0.1:43203}"
DB_NAME="${MATRIX_DB_NAME:-bevel_matrix}"
DB_USER="${MATRIX_DB_USER:-bevel}"
PYTHON="${PYTHON:-python3}"

echo "==> BEVEL Matrix Synapse install (cheap same-box)"
echo "    root: $MATRIX_ROOT"
echo "    server: $SERVER_NAME"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (sudo)" >&2
  exit 1
fi

mkdir -p "$MATRIX_ROOT/data/media" "$MATRIX_ROOT/data/uploads"
chown -R deploy:deploy "$MATRIX_ROOT" 2>/dev/null || chown -R deploy:deploy "$MATRIX_ROOT/data"

# ── Postgres DB ──────────────────────────────────────────────────────────────
echo "==> ensure database $DB_NAME"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  echo "    created $DB_NAME"
else
  echo "    $DB_NAME exists"
fi

# Prefer password from existing bevel DATABASE_URL if available
DB_PASS=""
if [[ -f /opt/bevel/services/api/.env ]]; then
  # shellcheck disable=SC1091
  set +u
  # extract password from postgresql+asyncpg://user:pass@host/db
  DB_PASS="$(grep -E '^DATABASE_URL=' /opt/bevel/services/api/.env 2>/dev/null | head -1 | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p' || true)"
  set -u
fi
if [[ -z "$DB_PASS" && -f /opt/bevel/apps/web/.env.production ]]; then
  DB_PASS="$(grep -E '^DATABASE_URL=' /opt/bevel/apps/web/.env.production 2>/dev/null | head -1 | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p' || true)"
fi
if [[ -z "$DB_PASS" ]]; then
  # read from peer auth — bevel role may use peer/trust locally
  DB_PASS="bevel"
fi

# ── Secrets ──────────────────────────────────────────────────────────────────
SECRETS_FILE="$MATRIX_ROOT/.secrets"
if [[ -f "$SECRETS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  echo "==> reusing tokens from $SECRETS_FILE"
else
  AS_TOKEN="$(openssl rand -hex 32)"
  HS_TOKEN="$(openssl rand -hex 32)"
  REG_SECRET="$(openssl rand -hex 32)"
  cat >"$SECRETS_FILE" <<EOF
# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) — mode 0600
MATRIX_AS_TOKEN=${AS_TOKEN}
MATRIX_HS_TOKEN=${HS_TOKEN}
MATRIX_REGISTRATION_SHARED_SECRET=${REG_SECRET}
EOF
  chmod 0600 "$SECRETS_FILE"
  chown deploy:deploy "$SECRETS_FILE"
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  echo "==> wrote new secrets $SECRETS_FILE"
fi

# ── Python venv + Synapse ────────────────────────────────────────────────────
echo "==> synapse venv (this may take a few minutes)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-dev build-essential libpq-dev libffi-dev libjpeg-dev libxslt1-dev zlib1g-dev >/dev/null

if [[ ! -d "$MATRIX_ROOT/.venv" ]]; then
  sudo -u deploy "$PYTHON" -m venv "$MATRIX_ROOT/.venv"
fi
# Pin a known-good Synapse; keep install lean
sudo -u deploy "$MATRIX_ROOT/.venv/bin/pip" install -q --upgrade pip wheel
sudo -u deploy "$MATRIX_ROOT/.venv/bin/pip" install -q \
  'matrix-synapse[postgres]==1.121.1' \
  'psycopg2-binary>=2.9'

# ── Signing key ──────────────────────────────────────────────────────────────
SIGNING_KEY="$MATRIX_ROOT/data/${SERVER_NAME}.signing.key"
if [[ ! -f "$SIGNING_KEY" ]]; then
  echo "==> generate signing key"
  sudo -u deploy "$MATRIX_ROOT/.venv/bin/python" - <<PY
from signedjson.key import generate_signing_key, write_signing_keys
from pathlib import Path
path = Path("${SIGNING_KEY}")
key = generate_signing_key("a")
with path.open("w") as f:
    write_signing_keys(f, [key])
print("wrote", path)
PY
  chown deploy:deploy "$SIGNING_KEY"
  chmod 0600 "$SIGNING_KEY"
fi

# ── log config ───────────────────────────────────────────────────────────────
if [[ -f "$REPO_ROOT/services/matrix/log.config" ]]; then
  cp "$REPO_ROOT/services/matrix/log.config" "$MATRIX_ROOT/log.config"
else
  cat >"$MATRIX_ROOT/log.config" <<'LOG'
version: 1
formatters:
  precise:
    format: '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
handlers:
  console:
    class: logging.StreamHandler
    formatter: precise
    level: WARNING
root:
  level: WARNING
  handlers: [console]
disable_existing_loggers: false
LOG
fi
chown deploy:deploy "$MATRIX_ROOT/log.config"

# ── homeserver.yaml ──────────────────────────────────────────────────────────
echo "==> homeserver.yaml"
cat >"$MATRIX_ROOT/homeserver.yaml" <<YAML
server_name: "${SERVER_NAME}"
pid_file: ${MATRIX_ROOT}/data/homeserver.pid
public_baseurl: "https://${SERVER_NAME}/"
soft_file_limit: 8192

listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    bind_addresses: ["127.0.0.1"]
    resources:
      - names: [client]
        compress: false

database:
  name: psycopg2
  args:
    user: ${DB_USER}
    password: "${DB_PASS}"
    database: ${DB_NAME}
    host: 127.0.0.1
    cp_min: 1
    cp_max: 5

log_config: "${MATRIX_ROOT}/log.config"
media_store_path: ${MATRIX_ROOT}/data/media
uploads_path: ${MATRIX_ROOT}/data/uploads
max_upload_size: 10M
max_image_pixels: "16M"

enable_registration: false
registration_shared_secret: "${MATRIX_REGISTRATION_SHARED_SECRET}"

report_stats: false
serve_server_wellknown: true

federation_domain_whitelist: []
allow_public_rooms_over_federation: false
allow_public_rooms_without_auth: false

presence:
  enabled: false
caches:
  global_factor: 0.25

app_service_config_files:
  - ${MATRIX_ROOT}/appservice-bevel.yaml

signing_key_path: "${SIGNING_KEY}"
trusted_key_servers: []
suppress_key_server_warning: true
YAML
chown deploy:deploy "$MATRIX_ROOT/homeserver.yaml"
chmod 0640 "$MATRIX_ROOT/homeserver.yaml"

# ── appservice registration ──────────────────────────────────────────────────
echo "==> appservice-bevel.yaml"
cat >"$MATRIX_ROOT/appservice-bevel.yaml" <<YAML
id: bevel
url: ${AS_URL}
as_token: "${MATRIX_AS_TOKEN}"
hs_token: "${MATRIX_HS_TOKEN}"
sender_localpart: bevel_bridge
namespaces:
  users:
    - exclusive: true
      regex: "@agent_.*:${SERVER_NAME//./\\.}"
    - exclusive: false
      regex: "@bevel_.*:${SERVER_NAME//./\\.}"
  aliases:
    - exclusive: true
      regex: "#.*_.*:${SERVER_NAME//./\\.}"
  rooms: []
rate_limited: false
protocols:
  - bevel
YAML
chown deploy:deploy "$MATRIX_ROOT/appservice-bevel.yaml"
chmod 0640 "$MATRIX_ROOT/appservice-bevel.yaml"

# ── systemd ──────────────────────────────────────────────────────────────────
echo "==> systemd bevel-matrix.service"
if [[ -f "$REPO_ROOT/services/matrix/bevel-matrix.service" ]]; then
  cp "$REPO_ROOT/services/matrix/bevel-matrix.service" /etc/systemd/system/bevel-matrix.service
else
  cp /dev/stdin /etc/systemd/system/bevel-matrix.service <<'UNIT'
[Unit]
Description=BEVEL Matrix Synapse (cheap same-box)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/opt/bevel/services/matrix
Environment=SYNAPSE_CACHE_FACTOR=0.25
MemoryHigh=384M
MemoryMax=512M
ExecStart=/opt/bevel/services/matrix/.venv/bin/python -m synapse.app.homeserver --config-path=/opt/bevel/services/matrix/homeserver.yaml
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
UNIT
fi
systemctl daemon-reload
systemctl enable bevel-matrix.service
systemctl restart bevel-matrix.service
sleep 3
systemctl is-active bevel-matrix.service || {
  echo "WARN: bevel-matrix not active yet; journal:"
  journalctl -u bevel-matrix -n 40 --no-pager || true
}

# ── Wire API env ─────────────────────────────────────────────────────────────
echo "==> wire MATRIX_* into API env files"
wire_env() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local tmp
  tmp="$(mktemp)"
  # strip old MATRIX_ lines then append
  grep -vE '^MATRIX_|^# ── Matrix' "$file" >"$tmp" || true
  cat >>"$tmp" <<EOF

# ── Matrix (Synapse same-box) ───────────────────────────────────────────────
MATRIX_ENABLED=1
MATRIX_HOMESERVER_URL=${HS_URL_LOCAL}
MATRIX_SERVER_NAME=${SERVER_NAME}
MATRIX_AS_TOKEN=${MATRIX_AS_TOKEN}
MATRIX_HS_TOKEN=${MATRIX_HS_TOKEN}
MATRIX_BOT_LOCALPART=bevel_bridge
EOF
  chown deploy:deploy "$tmp"
  chmod 0600 "$tmp"
  mv "$tmp" "$file"
  echo "    updated $file"
}

wire_env /opt/bevel/services/api/.env
# Also expose status to web build if present
if [[ -f /opt/bevel/apps/web/.env.production ]]; then
  web_tmp="$(mktemp)"
  grep -vE '^MATRIX_|^NEXT_PUBLIC_MATRIX_' /opt/bevel/apps/web/.env.production >"$web_tmp" || true
  cat >>"$web_tmp" <<EOF

# ── Matrix (public discovery) ───────────────────────────────────────────────
NEXT_PUBLIC_MATRIX_HOMESERVER_URL=https://${SERVER_NAME}
NEXT_PUBLIC_MATRIX_SERVER_NAME=${SERVER_NAME}
EOF
  chown deploy:deploy "$web_tmp"
  chmod 0600 "$web_tmp"
  mv "$web_tmp" /opt/bevel/apps/web/.env.production
  echo "    updated apps/web/.env.production (public URLs only; AS tokens stay on API)"
fi

# ── Alembic matrix tables ────────────────────────────────────────────────────
echo "==> alembic upgrade (matrix maps)"
sudo -u deploy bash -lc "
  set -euo pipefail
  cd /opt/bevel/services/api
  if [[ -f .venv/bin/activate ]]; then source .venv/bin/activate
  elif command -v uv >/dev/null; then
    uv run alembic upgrade head && exit 0
  fi
  if command -v alembic >/dev/null; then
    alembic upgrade head
  elif [[ -x .venv/bin/alembic ]]; then
    .venv/bin/alembic upgrade head
  else
    uv run alembic upgrade head
  fi
" || echo "WARN: alembic failed — run manually"

# ── Caddy ────────────────────────────────────────────────────────────────────
echo "==> Caddy matrix.bevel.is"
CADDYFILE=/etc/caddy/Caddyfile
if ! grep -q 'matrix.bevel.is' "$CADDYFILE" 2>/dev/null; then
  cat >>"$CADDYFILE" <<'CADDY'

# BEVEL Matrix (cheap same-box Synapse)
matrix.bevel.is {
    import common_headers
    encode gzip
    reverse_proxy 127.0.0.1:8008
    log {
        output file /var/log/caddy/matrix_bevel_is.log {
            roll_size 10MB
            roll_keep 3
        }
        format json
    }
}
CADDY
  echo "    appended matrix.bevel.is block"
else
  echo "    matrix.bevel.is already present"
fi

if command -v caddy >/dev/null; then
  caddy validate --config "$CADDYFILE" --adapter caddyfile
  # Reload only — never pkill caddy
  if pgrep -x caddy >/dev/null; then
    caddy reload --config "$CADDYFILE" --adapter caddyfile
    echo "    caddy reloaded"
  else
    echo "WARN: caddy not running — start with: caddy run --config $CADDYFILE --adapter caddyfile"
  fi
fi

# ── Restart API to pick up MATRIX_* ──────────────────────────────────────────
systemctl restart bevel-api.service || true
sleep 2

echo ""
echo "==> smoke"
curl -sS -o /dev/null -w "local HS versions %{http_code}\n" http://127.0.0.1:8008/_matrix/client/versions || true
curl -sS http://127.0.0.1:8008/_matrix/client/versions 2>/dev/null | head -c 200; echo
curl -sS -o /dev/null -w "matrix.bevel.is versions %{http_code}\n" https://matrix.bevel.is/_matrix/client/versions || true
curl -sS https://api.bevel.is/api/v1/matrix/status 2>/dev/null | head -c 400; echo
systemctl is-active bevel-matrix bevel-api caddy || true
free -h | head -2

echo ""
echo "==> done"
echo "    HS:      https://${SERVER_NAME}/_matrix/client/versions"
echo "    status:  https://api.bevel.is/api/v1/matrix/status"
echo "    secrets: ${SECRETS_FILE} (0600)"
echo "    cost:    \$0 extra EC2 — same box, MemoryMax=512M, federation off"
