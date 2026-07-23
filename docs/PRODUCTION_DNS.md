# BEVEL production DNS — `bevel.is` (Route 53)

**Account:** `637423563720`  
**Hosted zone ID:** `Z01074371LVNN1WNMK9OQ`  
**Apex:** `bevel.is`

## Nameservers (delegate at registrar)

Point the domain’s **NS** records at these four (exact set for this zone):

```
ns-1289.awsdns-33.org
ns-920.awsdns-51.net
ns-1953.awsdns-52.co.uk
ns-297.awsdns-37.com
```

Until the registrar uses these, public DNS will not resolve via Route 53.

### Registrar steps

1. Open the registrar where `bevel.is` is registered (Namecheap, Gandi, Cloudflare Registrar, etc.).
2. Set **custom nameservers** to the four hosts above (replace any parking NS).
3. Wait for delegation (often minutes; can take up to 24–48h).
4. Verify:

```bash
dig NS bevel.is +short
# expect the four awsdns-* hosts

dig CAA bevel.is +short
dig TXT bevel.is +short
```

## Host map (Caddy / product)

| Host | Role | Record (after edge is live) |
|------|------|-------------------------------|
| `bevel.is` | Platform entry / marketing | `A` or `ALIAS` → edge IP / LB |
| `www.bevel.is` | Apex alias | `CNAME` → `bevel.is` (or same A) |
| `app.bevel.is` | Optional product shell | `A` / `CNAME` → edge |
| `admin.bevel.is` | Operator console | `A` / `CNAME` → edge |
| `api.bevel.is` | FastAPI control plane | `A` / `CNAME` → edge |
| `realtime.bevel.is` | WebSocket realtime | `A` / `CNAME` → edge |
| `docs.bevel.is` | Docs | `A` / `CNAME` → edge |
| `cname.bevel.is` | Customer custom-domain target | `A` → edge (tenants CNAME here) |
| `*.bevel.is` | Multi-tenant hosts (optional) | wildcard `A` / `CNAME` → edge |
| `2x4m.bevel.is` / `bevel.2x4m.is` | Tenant examples | per-tenant YAML `hosts` |

**Do not create production A records until the deploy host (EC2 + Caddy, or LB) has a stable public IP / hostname.**

### After edge IP is known

```bash
# Example — replace EDGE_IP
aws route53 change-resource-record-sets --hosted-zone-id Z01074371LVNN1WNMK9OQ --change-batch '{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "bevel.is.",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "EDGE_IP"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.bevel.is.",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "EDGE_IP"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.bevel.is.",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "EDGE_IP"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "admin.bevel.is.",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "EDGE_IP"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "realtime.bevel.is.",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "EDGE_IP"}]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "cname.bevel.is.",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "EDGE_IP"}]
      }
    }
  ]
}'
```

Prefer low TTL (60–300s) until cutover is stable.

## Already created in Route 53

| Type | Name | Purpose |
|------|------|---------|
| `NS` / `SOA` | `bevel.is` | Zone defaults |
| `CAA` | `bevel.is` | Allow Let’s Encrypt (`letsencrypt.org`) for Caddy |
| `TXT` | `bevel.is` | Zone identity marker |
| `TXT` | `_bevel.bevel.is` | Internal zone-id note |

## Env (production)

```bash
NODE_ENV=production
BEVEL_ENV=production

# Platform auth
AUTH_URL=https://bevel.is
NEXTAUTH_URL=https://bevel.is
AUTH_COOKIE_DOMAIN=.bevel.is
AUTH_TRUST_HOST=true

# Services
ADMIN_URL=https://admin.bevel.is
BEVEL_API_URL=https://api.bevel.is
NEXT_PUBLIC_BEVEL_API_URL=https://api.bevel.is
REALTIME_URL=https://realtime.bevel.is
NEXT_PUBLIC_REALTIME_URL=https://realtime.bevel.is
BEVEL_CNAME_TARGET=cname.bevel.is

# Mobile release dart-defines
# BEVEL_BASE_URL=https://bevel.is
# BEVEL_API_URL=https://api.bevel.is
```

OAuth: add authorized origins/redirects for `https://bevel.is` (and org hosts as needed) in Google Cloud Console — see [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md).

## Deploy readiness checklist

- [x] Route 53 hosted zone `bevel.is`
- [ ] Registrar NS → AWS nameservers (above)
- [ ] `dig NS bevel.is` shows `awsdns-*`
- [ ] EC2 (or other) + Caddy with TLS for `*.bevel.is` / listed hosts
- [ ] A/AAAA (or ALIAS) records for apex + services
- [ ] Secrets in 1Password + server env (`AUTH_SECRET`, `FLEET_INTERNAL_API_KEY`, OAuth, Twilio)
- [ ] PostgreSQL production URL (no SQLite) — see [PRODUCTION_API.md](./PRODUCTION_API.md)
- [ ] FastAPI unit on `:43203` + Caddy `api.bevel.is` → API (not Next)
- [ ] Google OAuth production redirect URIs (`bevel.is` + `bevel.2x4m.cc`)
- [ ] Health checks: `https://api.bevel.is/health` (DB ok), web login both hosts, realtime

## CLI reference

```bash
aws route53 list-hosted-zones-by-name --dns-name bevel.is
aws route53 list-resource-record-sets --hosted-zone-id Z01074371LVNN1WNMK9OQ
```
