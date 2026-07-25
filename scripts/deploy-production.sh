#!/usr/bin/env bash
# Deploy BEVEL to the live EC2 (bevel.is / bevel.2x4m.cc / api.bevel.is).
#
# Usage:
#   ./scripts/deploy-production.sh              # origin/main
#   ./scripts/deploy-production.sh HEAD         # current branch tip (must be pushed)
#   ./scripts/deploy-production.sh abc1234      # specific SHA or ref
#   BEVEL_DEPLOY_REF=feat/foo ./scripts/deploy-production.sh
#
# Requires: SSH Host bevel-prod (ubuntu@34.200.88.66, key ~/.ssh/2x4m_ed25519)
# Never pkill caddy — reload only if Caddyfile changes.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF_INPUT="${1:-${BEVEL_DEPLOY_REF:-origin/main}}"
SSH_HOST="${BEVEL_DEPLOY_HOST:-bevel-prod}"

# Resolve local SHA when possible so the server can check it out after fetch.
if git rev-parse --verify "${REF_INPUT}^{commit}" >/dev/null 2>&1; then
  REF="$(git rev-parse --short=12 "${REF_INPUT}^{commit}")"
  FULL_REF="$(git rev-parse "${REF_INPUT}^{commit}")"
else
  REF="$REF_INPUT"
  FULL_REF="$REF_INPUT"
fi

echo "==> BEVEL production deploy"
echo "    host: $SSH_HOST"
echo "    ref:  $REF ($FULL_REF)"

# Ensure ref is on origin when deploying a local commit.
if git rev-parse --verify "${FULL_REF}" >/dev/null 2>&1; then
  if ! git branch -r --contains "$FULL_REF" 2>/dev/null | grep -q .; then
    echo "WARN: $REF does not appear on any remote-tracking branch."
    echo "      Push first: git push -u origin HEAD"
    if [[ "${BEVEL_DEPLOY_FORCE:-}" != "1" ]]; then
      echo "      Or set BEVEL_DEPLOY_FORCE=1 to try fetch-only on server."
      exit 1
    fi
  fi
fi

ssh -o ConnectTimeout=20 "$SSH_HOST" "bash -s" -- "$FULL_REF" <<'REMOTE'
set -euo pipefail
FULL_REF="$1"

sudo git config --global --add safe.directory /opt/bevel || true

echo "==> fetch + checkout ($FULL_REF)"
sudo -u deploy env FULL_REF="$FULL_REF" bash -s <<'INNER'
  set -euo pipefail
  cd /opt/bevel
  git fetch --prune origin --tags
  # Also fetch all remote branches so feature SHAs are present
  git fetch origin '+refs/heads/*:refs/remotes/origin/*' || true
  if git cat-file -e "${FULL_REF}^{commit}" 2>/dev/null; then
    git checkout -f "$FULL_REF"
  elif git cat-file -e "origin/${FULL_REF}^{commit}" 2>/dev/null; then
    git checkout -f "origin/${FULL_REF}"
  else
    echo "ERROR: ref not found after fetch: $FULL_REF"
    git rev-parse --short origin/main
    git branch -r | head -20
    exit 1
  fi
  git reset --hard HEAD
  echo "HEAD=$(git rev-parse --short HEAD) $(git log -1 --oneline)"
INNER

echo "==> free memory for next build if needed"
# cpu-logind / heavy scrapers have OOM'd next builds before
if command -v free >/dev/null; then free -h | head -2; fi

echo "==> API (uv + alembic + restart)"
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bevel/services/api
  # Load production secrets (same EnvironmentFile as systemd)
  if [[ -f .env ]]; then set -a; # shellcheck disable=SC1091
    source .env
    set +a
  fi
  if [[ -f .venv/bin/activate ]]; then source .venv/bin/activate; fi
  uv sync
  uv run alembic upgrade head
'
sudo systemctl restart bevel-api
sleep 2
systemctl is-active bevel-api

echo "==> Realtime (pnpm build + restart)"
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bevel
  # monorepo install if lock changed
  if command -v pnpm >/dev/null; then
    pnpm install --frozen-lockfile || pnpm install
  fi
  cd /opt/bevel/services/realtime
  pnpm install --frozen-lockfile || pnpm install
  pnpm run build
'
sudo systemctl restart bevel-realtime
sleep 1
systemctl is-active bevel-realtime

echo "==> Web (next build + restart 2x4m-bevel)"
# Next can OOM on 4GB hosts — drop page cache pressure best-effort
sync || true
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bevel
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
  pnpm install --frozen-lockfile || pnpm install
  cd apps/web
  # Prefer next build from package scripts
  if grep -q "\"build\"" package.json; then
    pnpm run build
  else
    pnpm exec next build
  fi
'
sudo systemctl restart 2x4m-bevel
sleep 3
systemctl is-active 2x4m-bevel

echo "==> smoke"
curl -sS -o /dev/null -w "bevel.2x4m.cc %{http_code}\n" https://bevel.2x4m.cc/ || true
curl -sS -o /dev/null -w "bevel.is %{http_code}\n" https://bevel.is/ || true
curl -sS https://api.bevel.is/health | head -c 400; echo
curl -sS https://realtime.bevel.is/health | head -c 200; echo
curl -sS https://bevel.2x4m.cc/api/health 2>/dev/null | head -c 300; echo

echo "==> services"
systemctl is-active 2x4m-bevel bevel-api bevel-realtime caddy postgresql
echo "==> done HEAD=$(sudo -u deploy git -C /opt/bevel rev-parse --short HEAD)"
REMOTE

echo ""
echo "==> Deploy finished. Live URLs:"
echo "    https://bevel.is"
echo "    https://bevel.2x4m.cc"
echo "    https://api.bevel.is/health"
echo "    https://status.bevel.is"
