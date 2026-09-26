#!/usr/bin/env bash
# Deploy BEVEL to the live EC2 (bevel.is / bevel.2x4m.cc / api.bevel.is).
#
# Usage:
#   ./scripts/deploy-production.sh              # origin/main
#   ./scripts/deploy-production.sh HEAD         # current branch tip (must be pushed)
#   ./scripts/deploy-production.sh abc1234      # specific SHA or ref
#   BEVEL_DEPLOY_REF=feat/foo ./scripts/deploy-production.sh
#   BEVEL_DEPLOY_FULL=1 ./scripts/deploy-production.sh HEAD   # always rebuild API + realtime
#
# Default is fast: rebuild Next (bevel.is), and only rebuild API / realtime
# when those trees changed. Stop the web unit during `next build` so systemd
# cannot crash-loop on a half-written .next.
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

DEPLOY_FULL="${BEVEL_DEPLOY_FULL:-0}"
echo "    mode: $([[ "$DEPLOY_FULL" == "1" ]] && echo full || echo fast-web)"

ssh -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=120 "$SSH_HOST" "bash -s" -- "$FULL_REF" "$DEPLOY_FULL" <<'REMOTE'
set -euo pipefail
FULL_REF="$1"
DEPLOY_FULL="${2:-0}"

sudo git config --global --add safe.directory /opt/bevel || true

echo "==> fetch + checkout ($FULL_REF)"
META="$(sudo -u deploy env FULL_REF="$FULL_REF" bash -s <<'INNER'
  set -euo pipefail
  cd /opt/bevel
  OLD_HEAD="$(git rev-parse HEAD)"
  git fetch --prune origin --tags
  git fetch origin '+refs/heads/*:refs/remotes/origin/*' || true
  if git cat-file -e "${FULL_REF}^{commit}" 2>/dev/null; then
    git checkout -f "$FULL_REF"
  elif git cat-file -e "origin/${FULL_REF}^{commit}" 2>/dev/null; then
    git checkout -f "origin/${FULL_REF}"
  else
    echo "ERROR: ref not found after fetch: $FULL_REF" >&2
    git rev-parse --short origin/main >&2
    git branch -r | head -20 >&2
    exit 1
  fi
  git reset --hard HEAD
  NEW_HEAD="$(git rev-parse HEAD)"
  echo "OLD_HEAD=${OLD_HEAD}"
  echo "NEW_HEAD=${NEW_HEAD}"
  echo "HEAD=$(git rev-parse --short HEAD) $(git log -1 --oneline)"
INNER
)"
echo "$META"
OLD_HEAD="$(echo "$META" | awk -F= '/^OLD_HEAD=/{print $2; exit}')"
NEW_HEAD="$(echo "$META" | awk -F= '/^NEW_HEAD=/{print $2; exit}')"

CHANGED="$(sudo -u deploy git -C /opt/bevel diff --name-only "$OLD_HEAD" "$NEW_HEAD" || true)"
NEED_API=0
NEED_RT=0
if [[ "$DEPLOY_FULL" == "1" ]]; then
  NEED_API=1
  NEED_RT=1
else
  echo "$CHANGED" | grep -qE '^(services/api/|packages/schema/|pnpm-lock.yaml|uv.lock)' && NEED_API=1 || true
  echo "$CHANGED" | grep -qE '^(services/realtime/|packages/realtime|packages/schema/|pnpm-lock.yaml)' && NEED_RT=1 || true
fi
echo "    api rebuild: $([[ $NEED_API -eq 1 ]] && echo yes || echo skip)"
echo "    realtime rebuild: $([[ $NEED_RT -eq 1 ]] && echo yes || echo skip)"

echo "==> free memory for next build if needed"
if command -v free >/dev/null; then free -h | head -2; fi

if [[ "$NEED_API" -eq 1 ]]; then
  echo "==> API (uv + alembic + restart)"
  sudo -u deploy bash -lc '
    set -euo pipefail
    cd /opt/bevel/services/api
    if [[ -f .env ]]; then set -a
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
else
  echo "==> API unchanged — skip"
fi

if [[ "$NEED_RT" -eq 1 ]]; then
  echo "==> Realtime (pnpm build + restart)"
  sudo -u deploy bash -lc '
    set -euo pipefail
    cd /opt/bevel
    if command -v pnpm >/dev/null; then
      pnpm install --frozen-lockfile || pnpm install
    fi
    cd /opt/bevel/services/realtime
    pnpm run build
  '
  sudo systemctl restart bevel-realtime
  sleep 1
  systemctl is-active bevel-realtime
else
  echo "==> Realtime unchanged — skip"
fi

echo "==> Web (next build + restart 2x4m-bevel)"
# Stop the unit first so Restart=always cannot boot a half-written .next.
sudo systemctl stop 2x4m-bevel || true
sudo systemctl reset-failed 2x4m-bevel || true
sync || true
sudo -u deploy bash -lc '
  set -euo pipefail
  cd /opt/bevel
  GIT_SHA="$(git rev-parse --short HEAD)"
  export NEXT_PUBLIC_GIT_SHA="$GIT_SHA"
  export BEVEL_GIT_SHA="$GIT_SHA"
  echo "    web build version $GIT_SHA"
  WEB_ENV="apps/web/.env.production"
  if [[ -f "$WEB_ENV" ]]; then
    if grep -q "^NEXT_PUBLIC_GIT_SHA=" "$WEB_ENV"; then
      sed -i "s/^NEXT_PUBLIC_GIT_SHA=.*/NEXT_PUBLIC_GIT_SHA=${GIT_SHA}/" "$WEB_ENV"
    else
      printf "\nNEXT_PUBLIC_GIT_SHA=%s\n" "$GIT_SHA" >> "$WEB_ENV"
    fi
    if grep -q "^BEVEL_GIT_SHA=" "$WEB_ENV"; then
      sed -i "s/^BEVEL_GIT_SHA=.*/BEVEL_GIT_SHA=${GIT_SHA}/" "$WEB_ENV"
    else
      printf "BEVEL_GIT_SHA=%s\n" "$GIT_SHA" >> "$WEB_ENV"
    fi
  fi
  export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
  cd apps/web
  pnpm run build
'
sudo systemctl start 2x4m-bevel
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:41009/api/health; then
    ok=1
    break
  fi
  sleep 1
done
systemctl is-active 2x4m-bevel
if [[ "$ok" -ne 1 ]]; then
  echo "WARN: web unit is up but /api/health did not answer yet"
fi

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
