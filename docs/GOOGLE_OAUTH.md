# BEVEL Google OAuth (Cloud Console)

Project: **x4m-493516** (2x4m / shared Derozic GCP)  
App name: **BEVEL**  
Client name: **BEVEL Web**  
Type: **Web application**

## 1. Authorized JavaScript origins

```
https://bevel.lvh.me
https://demo.bevel.lvh.me
```

(OAuth callback stays on the platform entry host. After login we hop to the org host
with a shared cookie domain — `.lvh.me` locally.)

## 2. Authorized redirect URIs

```
https://bevel.lvh.me/api/auth/callback/google
https://demo.bevel.lvh.me/api/auth/callback/google
```

## 3. Scopes (Data access / OAuth consent)

Non-sensitive scopes used by Auth.js:

| Scope | Purpose |
|-------|---------|
| `openid` | OpenID Connect |
| `https://www.googleapis.com/auth/userinfo.email` | Email |
| `https://www.googleapis.com/auth/userinfo.profile` | Name + avatar |

Runtime request (already in code): `openid email profile` with optional `hd=derozic.com`.

## 4. Audience / test users

- Prefer **Internal** if the GCP project is on a Workspace org.
- Or **External** + **Testing** with test users `@derozic.com`.

## 5. Branding

- App name: `BEVEL`
- Support email: your Workspace address
- Authorized domains: leave empty for pure `.lvh.me` local (Google does not verify `lvh.me`)

## 6. Wire credentials into BEVEL

After **Create**, copy Client ID + Client secret:

```bash
# from repo root
# either paste into .env:
AUTH_GOOGLE_ID=....apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-...
AUTH_GOOGLE_HD=derozic.com
AUTH_TRUST_HOST=true
AUTH_URL=https://bevel.lvh.me
NEXTAUTH_URL=https://bevel.lvh.me
```

Then restart web:

```bash
# kill :43200 and
cd apps/web && pnpm dev
```

Verify:

```bash
curl -s https://bevel.lvh.me/api/auth/providers
# should include "google"
```

Sign-in URL: https://bevel.lvh.me/login?callbackUrl=%2Fbevel

## Direct Console links

- Create client: https://console.cloud.google.com/auth/clients/create?project=x4m-493516  
- Classic create: https://console.cloud.google.com/apis/credentials/oauthclient?project=x4m-493516  
- Scopes: https://console.cloud.google.com/auth/scopes?project=x4m-493516  
- Branding: https://console.cloud.google.com/auth/branding?project=x4m-493516  
