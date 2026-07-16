# Claim workspace (production)

## Symptom

`https://bevel.2x4m.cc/claim` → **Could not claim workspace (500)**.

Claim **writes files** under `BEVEL_TENANTS_ROOT/{slug}/` (`bevel.yaml` + `theme.json`).  
A 500 almost always means the process **cannot write** that path (or an uncaught error before the fix).

## Required production env (2x4m-bevel.service)

```ini
Environment=BEVEL_TENANTS_ROOT=/opt/bevel/tenants
Environment=BEVEL_CLAIM_MODE=soft
Environment=BEVEL_PUBLIC_URL=https://bevel.2x4m.cc
Environment=AUTH_URL=https://bevel.2x4m.cc
Environment=NEXTAUTH_URL=https://bevel.2x4m.cc
Environment=AUTH_TRUST_HOST=true
ReadWritePaths=/opt/bevel
```

Create the directory once:

```bash
sudo mkdir -p /opt/bevel/tenants
sudo chown -R 2x4m:2x4m /opt/bevel   # use the service User/Group
sudo systemctl daemon-reload
sudo systemctl restart 2x4m-bevel.service
```

## Soft multi-tenant (default in production)

With `BEVEL_CLAIM_MODE=soft` (default when `NODE_ENV=production`):

- New workspace **namespace** = slug (realtime room key)
- **Host** stays `bevel.2x4m.cc` (no wildcard DNS required)
- After claim → `/onboarding?workspace={slug}` on the same host

Dedicated hosts (`slug.bevel.is`) need `BEVEL_CLAIM_MODE=dns` + DNS/Caddy.

## Ops preflight

```bash
curl -sS https://bevel.2x4m.cc/api/claim/workspace | jq .
# tenantsRootWritable should be true
```

## Local test

```bash
pnpm exec tsx packages/tenant-config/src/provision.test.ts
```

## API

| Method | Auth | Result |
|--------|------|--------|
| GET | no | preflight: root path + writable |
| POST `{ name, slug }` | session | 200 create · 401 · 400 · 409 · **503** if not writable |
