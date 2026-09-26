# Sign in with Microsoft — Bevel

**Entity login:** Google first, Apple second, Microsoft third on the welcome card.

Bevel uses Auth.js **Microsoft Entra ID** (`microsoft-entra-id`) for work accounts.

## Azure app registration

1. Microsoft Entra admin center → App registrations → New registration
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (`common`)
3. Redirect URIs (Web):
   - `https://bevel.lvh.me/api/auth/callback/microsoft-entra-id`
   - `https://bevel.is/api/auth/callback/microsoft-entra-id`
   - `https://www.bevel.is/api/auth/callback/microsoft-entra-id`
4. Certificates & secrets → New client secret

Store both environments in one 1Password item (vault `dev`):

```
op item create --category=api-credential --title="Bevel Microsoft OAuth" --vault="dev"
```

| Field | Value |
| --- | --- |
| `MICROSOFT_CLIENT_ID` | Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Client secret |
| `MICROSOFT_TENANT_ID` | `common` |

Auth.js also reads `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER`.

`GET /api/auth/microsoft/status` reports `{ configured }` with no secrets.

The Microsoft button stays on `/login` even before credentials are set. Until the secret is present, the click shows: “Microsoft sign-in is not configured on this server yet. Use Google.”
