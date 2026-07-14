# BEVEL Google OAuth (Cloud Console)

Project: **x4m-493516** (2x4m / shared Derozic GCP)  
App name: **BEVEL**  
Client name: **BEVEL Web**  
Type: **Web application**

## 1. Authorized JavaScript origins

```
https://bevel.lvh.me
https://demo.bevel.lvh.me
https://bevel.2x4m.lvh.me
```

OAuth **callback** stays on the platform entry host (`AUTH_URL` / `NEXTAUTH_URL` =
`https://bevel.lvh.me`). Users may click “Sign in” on an org host
(`bevel.2x4m.lvh.me`); Auth.js still sends `redirect_uri` to the platform host.

That only works when **all** Auth.js cookies (session, CSRF, PKCE, state) share
`AUTH_COOKIE_DOMAIN=.lvh.me`. Host-only `__Host-` CSRF cookies break the hop and
surface as Auth.js `Configuration` (“Google OAuth credentials may be missing”).

After login, `/welcome` hops to the org host with the shared session cookie.

## 2. Authorized redirect URIs

```
https://bevel.lvh.me/api/auth/callback/google
https://demo.bevel.lvh.me/api/auth/callback/google
```

(Org hosts do **not** need their own Google redirect URI while `AUTH_URL` pins
callbacks to the platform. Optional: add org-host callbacks only if you drop the
`AUTH_URL` pin and run same-host OAuth.)
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
# Required for org-host → platform OAuth hop (PKCE/session shared across *.lvh.me)
AUTH_COOKIE_DOMAIN=.lvh.me
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
