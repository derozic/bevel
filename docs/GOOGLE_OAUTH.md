# BEVEL Google OAuth (standalone GCP project)

| | |
|--|--|
| **Project ID** | `gen-lang-client-0768551780` (immutable ID; rename **display name** to `BEVEL`) |
| **Project number** | `103038707422` |
| **Credentials** | https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0768551780 |
| **Consent / branding** | https://console.cloud.google.com/auth/branding?project=gen-lang-client-0768551780 |

> **Do not use** `decli-502814` (number `99449007158`) — that is the live **decli** product
> (`GOOGLE_CLIENT_ID` prefix `99449007158-…`).  
> **Do not keep** BEVEL on shared `x4m-493516` (`336973686985-…`) once this project is wired —
> that pool hit client/branding ceilings.

Previously this project was a retired decli experiment; decli code/docs now point only at
`decli-502814`. Safe to rebrand for BEVEL.

---

## 1. Rename project display name (optional, recommended)

1. Open [IAM & Admin → Settings](https://console.cloud.google.com/iam-admin/settings?project=gen-lang-client-0768551780)
2. **Project name** → `BEVEL` (Project **ID** stays `gen-lang-client-0768551780` — Google does not allow changing IDs)
3. Save

---

## 2. OAuth consent screen (branding)

1. [OAuth branding / consent](https://console.cloud.google.com/auth/branding?project=gen-lang-client-0768551780)
2. **App name:** `BEVEL`
3. **User support email:** your Workspace address
4. **Audience:** **Internal** if only Workspace; **External** + Testing if personal Gmail test users
5. **Authorized domains** (production):
   - `bevel.is`
   - `2x4m.cc` (if you use org hosts under that zone in consent links)
6. **Scopes** (non-sensitive only for sign-in):

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

Runtime request in code: `openid email profile` (optional `hd=derozic.com`).

7. Remove any leftover **decli** branding, test users only needed for External+Testing.

---

## 3. Create a dedicated OAuth Web client

1. [Credentials → Create credentials → OAuth client ID](https://console.cloud.google.com/apis/credentials/oauthclient?project=gen-lang-client-0768551780)
2. Application type: **Web application**
3. Name: `BEVEL Web`
4. **Authorized JavaScript origins:**

```
https://bevel.is
https://www.bevel.is
https://bevel.2x4m.cc
https://bevel.lvh.me
https://bevel.2x4m.lvh.me
```

5. **Authorized redirect URIs** (exact match required):

```
https://bevel.is/api/auth/callback/google
https://www.bevel.is/api/auth/callback/google
https://bevel.2x4m.cc/api/auth/callback/google
https://bevel.lvh.me/api/auth/callback/google
https://bevel.2x4m.lvh.me/api/auth/callback/google
```

6. Create → copy **Client ID** + **Client secret**  
   - 1Password: create/update item **BEVEL Google OAuth** (dev + prod labels)  
   - Client ID will start with **`103038707422-…`** (this project’s number)

Delete or ignore any old broken OAuth clients left from the gen-lang era (unless something
still uses them — nothing in decli or bevel should).

---

## 4. Enable APIs (minimum for login)

```
oauth2.googleapis.com
people.googleapis.com
```

Console: https://console.cloud.google.com/apis/library?project=gen-lang-client-0768551780

---

## 5. Wire credentials into BEVEL

### Local (repo root `.env` + `apps/web`)

```bash
AUTH_GOOGLE_ID=103038707422-….apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-…
AUTH_GOOGLE_HD=derozic.com   # optional Workspace hint
AUTH_URL=https://bevel.lvh.me
NEXTAUTH_URL=https://bevel.lvh.me
AUTH_TRUST_HOST=true
AUTH_COOKIE_DOMAIN=.lvh.me
```

### Production (EC2 `apps/web/.env.production` + systemd already sets AUTH_URL)

```bash
AUTH_GOOGLE_ID=103038707422-….apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-…
AUTH_URL=https://bevel.is
NEXTAUTH_URL=https://bevel.is
BEVEL_PUBLIC_URL=https://bevel.is
AUTH_TRUST_HOST=true
AUTH_COOKIE_DOMAIN=.bevel.is
```

Then restart web:

```bash
# prod
ssh bevel-prod 'sudo systemctl restart 2x4m-bevel'
# verify
./scripts/fix-google-oauth-prod.sh --verify-only
```

---

## 6. Verify

```bash
# providers include google
curl -sS https://bevel.is/api/auth/providers | jq 'keys'

# sign-in must 302 to accounts.google.com with new client_id
./scripts/fix-google-oauth-prod.sh
```

Manual: open https://bevel.is/login → Continue with Google → consent shows **BEVEL** → land on org `/#general`.

| Error | Meaning |
|-------|---------|
| `invalid_client` | Wrong/missing ID or secret on server |
| `redirect_uri_mismatch` | Callback URI not listed exactly on this client |
| `access_denied` / app blocked | Consent Internal + wrong Workspace / missing test user |

---

## 7. Relationship to other projects

| Project | Owner | Use |
|---------|-------|-----|
| `decli-502814` (`99449007158`) | **decli** | Live product OAuth + Drive/Docs APIs |
| `gen-lang-client-0768551780` (`103038707422`) | **BEVEL** | Standalone BEVEL auth (this doc) |
| `x4m-493516` (`336973686985`) | Shared 2x4m | Legacy BEVEL client; retire after cutover |

---

## 8. Cutover checklist

- [ ] Display name → BEVEL
- [ ] Consent branding → BEVEL
- [ ] New `BEVEL Web` client + redirect URIs above
- [ ] Secrets in 1Password **BEVEL Google OAuth**
- [ ] Local `.env` updated
- [ ] Prod `.env.production` updated + `2x4m-bevel` restarted
- [ ] Login smoke on https://bevel.is/login
- [ ] Confirm decli still uses only `decli-502814` (https://decli.dev login)
- [ ] Remove BEVEL redirects from any old x4m client (optional cleanup)
