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

echo "==> Agents fleet runner (required by realtime agent-dispatch)"
# @mentions load require($AGENTS_REPO_ROOT/dist/runner.js). Default path without
# AGENTS_REPO_ROOT is /opt/bevel/dist/runner.js which has no axios deps.
sudo -u deploy bash -lc '
  set -euo pipefail
  if [[ -f /opt/bevel/agents/package.json ]]; then
    cd /opt/bevel/agents
    if command -v pnpm >/dev/null; then
      pnpm install --frozen-lockfile || pnpm install
    fi
    if [[ -f tsconfig.json ]]; then
      pnpm run build || true
    fi
    test -f dist/runner.js
    # Federated souls: $AGENTS_FEDERATED_ROOT/agents/<id>/SOUL.md
    for agent_id in johnny mildred tegan hermes brain; do
      mkdir -p "agents/${agent_id}"
      if [[ -f "src/agents/${agent_id}/SOUL.md" ]]; then
        cp "src/agents/${agent_id}/SOUL.md" "agents/${agent_id}/SOUL.md"
      elif [[ -f "dist/agents/${agent_id}/SOUL.md" ]]; then
        cp "dist/agents/${agent_id}/SOUL.md" "agents/${agent_id}/SOUL.md"
      elif [[ ! -f "agents/${agent_id}/SOUL.md" && "${agent_id}" == "johnny" ]]; then
        cat > agents/johnny/SOUL.md <<'"'"'SOUL'"'"'
# Johnny — Platform Reliability Steward
You are Johnny, platform reliability steward. Respond briefly and practically in fleet chat.
SOUL
      fi
    done
  else
    echo "WARN: /opt/bevel/agents missing — fleet @mentions will fail MODULE_NOT_FOUND"
  fi
'

# Keep realtime env pointed at the working agents install (do not clobber secrets).
ENVF=/opt/bevel/services/realtime/.env
if [[ -f "$ENVF" ]]; then
  sudo bash -lc '
    set -euo pipefail
    ENVF=/opt/bevel/services/realtime/.env
    upsert() {
      local k="$1" v="$2"
      if grep -q "^${k}=" "$ENVF" 2>/dev/null; then
        sed -i "s|^${k}=.*|${k}=${v}|" "$ENVF"
      else
        echo "${k}=${v}" >> "$ENVF"
      fi
    }
    upsert AGENTS_REPO_ROOT /opt/bevel/agents
    upsert AGENTS_REGISTRY_PATH /opt/bevel/agents/registry.json
    upsert AGENTS_FEDERATED_ROOT /opt/bevel/agents
    upsert AGENTS_SESSIONS_DIR /opt/bevel/data/sessions
    # AgentTrace events must land under the same tenant slug the web Trace pane queries
    upsert BEVEL_DEFAULT_TENANT 2x4m
    if ! grep -q '^API_INTERNAL_URL=' "$ENVF" 2>/dev/null; then
      upsert API_INTERNAL_URL http://127.0.0.1:43203
    fi
    chown deploy:deploy "$ENVF"
    chmod 600 "$ENVF"
    if ! grep -q "^OPENROUTER_API_KEY=." "$ENVF" 2>/dev/null; then
      echo "WARN: OPENROUTER_API_KEY missing in $ENVF — fleet LLM calls will 401"
    fi
  '
fi

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

echo "==> Fleet health smoke (realtime /health)"
# Fail deploy loudly if runner cannot load or OpenRouter is unset
if command -v curl >/dev/null; then
  HEALTH_JSON="$(curl -sS --max-time 5 http://127.0.0.1:43208/health || true)"
  echo "$HEALTH_JSON" | head -c 800
  echo
  if echo "$HEALTH_JSON" | grep -q '"runner":"ok"' && echo "$HEALTH_JSON" | grep -q '"openrouter":"configured"'; then
    echo "fleet health: ok"
  else
    echo "WARN: fleet health degraded — check AGENTS_REPO_ROOT / OPENROUTER_API_KEY / agents install"
    # Do not hard-fail whole deploy (web may still be fine); operators see WARN
  fi
fi

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
