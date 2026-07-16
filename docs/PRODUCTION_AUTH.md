# Production auth — `bevel.2x4m.cc` and loopback traps

## Symptom

After Google sign-in on `https://bevel.2x4m.cc/login`, the browser lands on:

```
https://localhost:41009/%5Egeneral
```

`%5E` is `^` — the workspace home path is `/^general`.  
`41009` is the **systemd bind port** for BEVEL on the 2x4m EC2 host
(`next start --port 41009 --hostname 127.0.0.1`).

## Root cause

1. Ansible unit for `bevel` sets `skip_shared_env: true` (correct — separate app from 2x4m monorepo env).
2. Older `service.j2` only injected `AUTH_URL` / `NEXTAUTH_URL` when **not** `skip_shared_env`.
3. Auth.js therefore built post-login redirects from the **request / bind base** → `http://localhost:41009`.
4. Relative callback `/^general` became `https://localhost:41009/%5Egeneral`.

## Fixes

### Code (BEVEL monorepo)

- `packages/auth` redirect callback rejects loopback bases and prefers  
  `AUTH_URL` → `NEXTAUTH_URL` → `BEVEL_PUBLIC_URL` → request host → `tenant.host`.
- Allows cross-host hops to `*.2x4m.cc`, `*.bevel.is`, etc.
- `publicTenantUrl` ignores loopback env URLs.

### Infra (2x4m Ansible)

`roles/app/templates/service.j2` always sets for **every** Node service:

```
Environment=NEXTAUTH_URL=https://{{ host }}
Environment=AUTH_URL=https://{{ host }}
Environment=AUTH_TRUST_HOST=true
```

For `bevel` also:

```
Environment=BEVEL_PUBLIC_URL=https://bevel.2x4m.cc
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
