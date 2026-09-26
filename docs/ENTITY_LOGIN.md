# Entity login — Bevel

**Canonical:** `~/dev/ENTITY_LOGIN.md`
**Reference implementation:** Preso (`~/dev/preso/docs/ENTITY_LOGIN.md`)
**Status in this repo:** Adopt (apex `/login` is the welcome card; Google works; Apple REST is wired — needs the Services ID + `.p8` in 1Password `Bevel Apple Sign In`; Microsoft Entra is wired — needs `Bevel Microsoft OAuth`)

Bevel owns **workspaces** after login (`docs/IDENTITY.md`). Apex person sign-in is:

1. Sign in with Google
2. Sign in with Apple
3. Sign in with Microsoft
4. Unified **mobile or email** field (digits → SMS OTP; `@` → email magic link + 6-digit backup)

OTP codes use one long input (not six boxes). There is no password.

Phone + email remain `data-cta` `phone` and `email-link`. Microsoft is `data-cta` `microsoft`. Follow-on: move OTP JSON files to PostgreSQL `otp_challenges`.

No password. Then the Space chooser (`/workspaces`): Private + memberships.

| | Bevel |
| --- | --- |
| Local | https://bevel.lvh.me (tenant host) / apex login |
| Env prefix | `BEVEL_` |
| 1Password | `Bevel Google OAuth`, `Bevel Apple Sign In`, `Bevel Microsoft OAuth`; shared **OTwilio** + **SendGrid-decli** |
| Google callback | product/tenant host `/auth/google/callback` |
| Apple callback | product/tenant host `/auth/apple/callback` |

Mobile (`apps/mobile`) uses the same four methods. Native Google remains for
Workspace scopes; it is not a replacement for Apple/OTP.
