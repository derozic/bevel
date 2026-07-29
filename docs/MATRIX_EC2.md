# Matrix on EC2 — cost & cutover

## Cheap vs expensive

| Option | Monthly add-on | RAM / disk | When to use |
|--------|----------------|------------|-------------|
| **A. Same box (chosen)** | **~$0** | Caps Synapse at **512MB**; media on root FS | Small fleet, no federation yet, BEVEL dual-write |
| **B. Dedicated t3.small** | **~$12–15** | 2GB dedicated | Federation, Element power users, media |
| **C. t3.medium + RDS** | **~$40–80** | Comfortable HS + managed DB | Multi-tenant E2EE + federation |

**bevel-prod today:** ~3.7 GiB RAM, ~1.9 GiB available, root disk ~4 GiB free.  
**A** fits if we keep federation **off**, presence **off**, media **10 MB** cap, and `MemoryMax=512M`.

## What this cutover does

1. Postgres DB `bevel_matrix` on existing Postgres 16  
2. Synapse in `/opt/bevel/services/matrix/.venv` on `127.0.0.1:8008`  
3. systemd `bevel-matrix.service`  
4. Caddy `matrix.bevel.is` → 8008 (**reload**, never kill Caddy)  
5. API `MATRIX_*` env + alembic `0003` maps  
6. DNS: `matrix.bevel.is` already A → same IP as `bevel.is` (verified)

## Install

```bash
# from laptop (repo must be on server at HEAD with this script)
ssh bevel-prod 'sudo bash /opt/bevel/scripts/install-matrix-synapse.sh'
```

Or after deploy:

```bash
./scripts/deploy-production.sh HEAD
ssh bevel-prod 'sudo bash /opt/bevel/scripts/install-matrix-synapse.sh'
```

## Verify

```bash
curl -sS https://matrix.bevel.is/_matrix/client/versions | jq .
curl -sS https://api.bevel.is/api/v1/matrix/status | jq .
systemctl status bevel-matrix --no-pager
```

Expect status: `enabled: true`, `configured: true`, `serverName: matrix.bevel.is`.

## Security notes

- AS/HS tokens only on **API** host env (not Next public env).  
- Federation whitelist empty — no open s2s.  
- Rooms created by BEVEL AS are **private_chat**.  
- Secrets: `/opt/bevel/services/matrix/.secrets` mode 0600 + 1Password item **BEVEL Matrix Synapse**.

## When to leave “cheap” mode

Move to option **B** if:

- RSS of `bevel-matrix` regularly hits 512M OOM  
- You enable `matrixFederation` for customers  
- Element Call / large media becomes primary UX  

## Rollback

```bash
sudo systemctl disable --now bevel-matrix
# remove matrix.bevel.is block from /etc/caddy/Caddyfile, then:
sudo caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
# clear MATRIX_ENABLED from API .env and restart bevel-api
```
