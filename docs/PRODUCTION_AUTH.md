# Production auth — `bevel.is`, `bevel.2x4m.cc`, and loopback traps

## Symptom A — localhost after login

After Google sign-in, the browser lands on:

```
https://localhost:41009/%5Egeneral
```

`%5E` is `^` — the workspace home path is `/^general`.  
`41009` is the **systemd bind port** for BEVEL on the 2x4m EC2 host
(`next start --port 41009 --hostname 127.0.0.1`).

### Root cause

1. Ansible unit for `bevel` sets `skip_shared_env: true` (correct — separate app from 2x4m monorepo env).
2. Older `service.j2` only injected `AUTH_URL` / `NEXTAUTH_URL` when **not** `skip_shared_env`.
3. Auth.js therefore built post-login redirects from the **request / bind base** → `http://localhost:41009`.
4. Relative callback `/^general` became `https://localhost:41009/%5Egeneral`.

### Fix

- `packages/auth` redirect callback rejects loopback bases and prefers  
  **request host** → `AUTH_URL` → `NEXTAUTH_URL` → `BEVEL_PUBLIC_URL` → `tenant.host`.
- Allows cross-host hops to `*.2x4m.cc`, `*.bevel.is`, etc.
- `publicTenantUrl` always uses **tenant.host** (never rewrites org hops to platform `BEVEL_PUBLIC_URL`).

## Symptom B — signed out after hop `bevel.is` → `bevel.2x4m.cc`

Session cookies cannot be shared across different registrable domains
(`.bevel.is` vs `.2x4m.cc`). Local multi-tenant works under `.lvh.me` only.

### Fix — dual path

1. **Same-host OAuth** when the user starts on the org host (`bevel.2x4m.cc`):  
   set `AUTH_TRUST_HOST=true` and **do not pin** `AUTH_URL` to a single host so Auth.js
   builds `redirect_uri` from the request Host. Add both Google redirect URIs:

```
https://bevel.is/api/auth/callback/google
https://bevel.2x4m.cc/api/auth/callback/google
```

2. **Cross-domain handoff** when login starts on platform (`bevel.is`) and home tenant
   is on `bevel.2x4m.cc`:
   - `/welcome` issues a short-lived code via FastAPI `POST /api/v1/auth/handoff`
     (Postgres table `auth_handoff_codes`, internal key required)
   - Redirect to `https://bevel.2x4m.cc/api/auth/handoff?code=…&callbackUrl=/^general`
   - Org host redeems code → Auth.js credentials provider `handoff` → host-local session

Cookie domain: `AUTH_COOKIE_DOMAIN=.bevel.is` applies only when the request host is under
`.bevel.is`. On `bevel.2x4m.cc` cookies stay host-only.

### Infra (2x4m Ansible / systemd)

Prefer:

```
Environment=AUTH_TRUST_HOST=true
Environment=BEVEL_PUBLIC_URL=https://bevel.is
Environment=AUTH_COOKIE_DOMAIN=.bevel.is
Environment=BEVEL_API_URL=http://127.0.0.1:43203
Environment=FLEET_INTERNAL_API_KEY=…
# Avoid AUTH_URL pin when one Next process serves multiple production hosts.
# Environment=AUTH_URL=https://bevel.is
```

## Claim workspace (500 → writable tenants)

See [CLAIM_WORKSPACE.md](./CLAIM_WORKSPACE.md). Minimum on the host:

```bash
sudo mkdir -p /opt/bevel/tenants
sudo chown -R deploy:deploy /opt/bevel
# systemd: BEVEL_TENANTS_ROOT=/opt/bevel/tenants + ReadWritePaths=/opt/bevel
curl -sS https://bevel.2x4m.cc/api/claim/workspace | jq .tenantsRootWritable
```

## Deploy checklist

1. Ship BEVEL build with auth redirect fix to `/opt/bevel`.
2. Redeploy / re-render systemd unit so `AUTH_URL=https://bevel.2x4m.cc` is set:

```bash
systemctl cat 2x4m-bevel.service | rg 'AUTH_URL|NEXTAUTH|BEVEL_PUBLIC'
# expect https://bevel.2x4m.cc — never localhost:41009
sudo systemctl daemon-reload
sudo systemctl restart 2x4m-bevel.service
```

3. Google Cloud Console authorized redirect URI:

```
https://bevel.2x4m.cc/api/auth/callback/google
```

4. Smoke:

```bash
curl -s https://bevel.2x4m.cc/api/auth/providers | jq .
# callbackUrl should be https://bevel.2x4m.cc/...
```

Sign in → land on `https://bevel.2x4m.cc/^general` (or encoded `%5Egeneral` **on that host**).
