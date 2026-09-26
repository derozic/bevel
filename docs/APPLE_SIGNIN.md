# Sign in with Apple — Bevel

**Entity standard:** `~/dev/ENTITY_LOGIN.md` · **This repo:** `docs/ENTITY_LOGIN.md`

Bevel talks to Apple ID over the raw REST APIs. We mint the client-secret JWT
(ES256) and verify identity tokens against Apple's JWKS. Google remains first.

## Apple Developer setup

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)
2. App ID `com.derozic.bevel.bevelApp` with **Sign In with Apple** enabled.
3. Services ID (web client id) `com.derozic.bevel.web` with Sign In with Apple:
   - Domains: `bevel.lvh.me`, `bevel.is`, `www.bevel.is`
   - Return URLs (exact):
     - `https://bevel.lvh.me/auth/apple/callback`
     - `https://bevel.is/auth/apple/callback`
     - `https://www.bevel.is/auth/apple/callback`
4. Key → Sign In with Apple, tied to App ID `com.derozic.bevel.bevelApp`.
   Download the `.p8`. Note Key ID and Team ID (`8A36CUVEDS`).

Store both environments in one 1Password item (vault `dev`):

```
op item create --category=api-credential --title="Bevel Apple Sign In" --vault="dev"
```

| Field | Value |
| --- | --- |
| `APPLE_CLIENT_ID` | `com.derozic.bevel.web` |
| `APPLE_APP_ID` | `com.derozic.bevel.bevelApp` |
| `APPLE_TEAM_ID` | `8A36CUVEDS` |
| `APPLE_KEY_ID` | 10-character key id |
| `APPLE_PRIVATE_KEY` | Full PEM, newlines as `\n` |
| `APPLE_CALLBACK_URL` | `https://bevel.lvh.me/auth/apple/callback` (production uses the request host) |

Local: repo `.env` (sourced by `scripts/iterm-tabs/01-web.sh`). Production:
GitHub Actions → AWS Secrets Manager as `BEVEL_APPLE_*`.

`GET /api/auth/apple/status` reports `{ configured }` with no secrets.

## Endpoints

- `GET /auth/apple?return_to=` — redirect to Apple
- `GET|POST /auth/apple/callback` — Apple `form_post` lands here
- `POST /auth/apple/mobile` `{ identity_token, full_name?, email? }`
- `GET /api/auth/apple/status`

The Apple button stays on `/login` even before credentials are set.
Until the `.p8` is present, `/auth/apple` returns a clear configuration error.
