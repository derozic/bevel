# Production FastAPI + Postgres — `api.bevel.is`

## Architecture

| Process | Bind | Public |
|---------|------|--------|
| Next web | `127.0.0.1:41009` | `bevel.is`, `bevel.2x4m.cc` |
| FastAPI | `127.0.0.1:43203` | `api.bevel.is` |
| Postgres | `127.0.0.1:5432` | (local only) DB `bevel` |

**No SQLite. No Docker. No in-memory domain store.**

## One-time Postgres

```bash
sudo -u postgres createuser -P bevel   # or role already present
sudo -u postgres createdb -O bevel bevel
```

Store URL in 1Password (title: **BEVEL PostgreSQL**) and systemd:

```
DATABASE_URL=postgresql+asyncpg://bevel:SECRET@127.0.0.1:5432/bevel
```

## Migrate + run

```bash
cd /opt/bevel/services/api
uv sync
export DATABASE_URL=postgresql+asyncpg://bevel:SECRET@127.0.0.1:5432/bevel
uv run alembic upgrade head
```

### systemd unit sketch (`/etc/systemd/system/bevel-api.service`)

```ini
[Unit]
Description=BEVEL FastAPI control plane
After=network.target postgresql.service
Wants=postgresql.service

[Service]
User=deploy
Group=deploy
WorkingDirectory=/opt/bevel/services/api
Environment=DATABASE_URL=postgresql+asyncpg://bevel:SECRET@127.0.0.1:5432/bevel
Environment=BEVEL_TENANTS_ROOT=/opt/bevel/tenants
Environment=FLEET_INTERNAL_API_KEY=SECRET
Environment=BEVEL_ENV=production
Environment=PUBLIC_API_URL=https://api.bevel.is
Environment=PUBLIC_WEB_URL=https://bevel.is
ExecStart=/opt/bevel/services/api/.venv/bin/uvicorn bevel_api.main:app --host 127.0.0.1 --port 43203
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bevel-api.service
curl -sS https://api.bevel.is/health | jq .
# expect database.status == "ok"
```

## Caddy

`api.bevel.is` must reverse-proxy to **43203**, not the Next web port:

```caddy
api.bevel.is {
	reverse_proxy 127.0.0.1:43203
}
```

Reload Caddy (never kill the shared instance):

```bash
caddy validate --config /path/to/Caddyfile
caddy reload --config /path/to/Caddyfile --adapter caddyfile
```

## Web env (same host)

```ini
Environment=BEVEL_API_URL=https://api.bevel.is
# or loopback for server-side handoff issue:
# Environment=BEVEL_API_URL=http://127.0.0.1:43203
Environment=FLEET_INTERNAL_API_KEY=SECRET
Environment=NEXT_PUBLIC_BEVEL_API_URL=https://api.bevel.is
```

Realtime should set `API_INTERNAL_URL=http://127.0.0.1:43203` (or public API) so fleet hydrate/persist hits Postgres-backed fleet routes.

## Smoke

```bash
curl -sS https://api.bevel.is/health | jq .
curl -sS https://api.bevel.is/api/v1/tenants | jq .
curl -sS -H "X-Fleet-Internal-Key: $FLEET_INTERNAL_API_KEY" \
  https://api.bevel.is/api/v1/fleet/channels?tenant=2x4m | jq .
```

## Auth handoff

Platform login on `bevel.is` that must land on `bevel.2x4m.cc` issues a one-time code via:

`POST /api/v1/auth/handoff` (internal key)

Org host redeems at `GET https://bevel.2x4m.cc/api/auth/handoff?code=…`.

See [PRODUCTION_AUTH.md](./PRODUCTION_AUTH.md).
