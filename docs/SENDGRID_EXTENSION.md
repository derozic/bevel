# SendGrid Extension — escalation email

Hard escalations (`^handle`) deliver more than a standard push:

1. Timeline item (`kind=escalation`, `priority=high`)
2. High-priority native push (channel `bevel_escalation`)
3. **Login / resume popup** (native Escalation Inbox)
4. **Email via SendGrid** when this Extension is configured

Soft `@handle` mentions do **not** email by default.

## Production secrets (1Password)

Store under **BEVEL SendGrid** (dev vault + prod labels):

| Field | Env |
|-------|-----|
| API key | `SENDGRID_API_KEY` |
| From email (verified) | `SENDGRID_FROM_EMAIL` |
| From name | `SENDGRID_FROM_NAME` (optional, default `BEVEL`) |
| Kill switch | `SENDGRID_ENABLED=0` to disable without removing the key |

On EC2 (`bevel-api` systemd EnvironmentFile `/opt/bevel/services/api/.env`):

```bash
SENDGRID_API_KEY=SG.…
SENDGRID_FROM_EMAIL=noreply@your-verified-domain
SENDGRID_FROM_NAME=BEVEL
PUBLIC_WEB_URL=https://bevel.2x4m.cc
```

Restart: `sudo systemctl restart bevel-api`

## Status API

```http
GET /api/v1/extensions/sendgrid
```

Returns `{ configured: true|false, fromEmail?, uses: ["escalation_email"] }` — never the key.

## Console

Extensions UI lists **SendGrid** under Communication. Wire-up is server env for v1 (no browser key entry).

## Idempotency

Fan-out stamps `payload.emailedAt` on the timeline item after a successful send so retries do not spam.
