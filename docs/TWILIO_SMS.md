# BEVEL · Twilio (cheapest path · paid plans only)

**Product gate:** SMS is **not** on Free. Plans **pro | team | enterprise** only
(`plan` in `tenants/<slug>/bevel.yaml`, plus optional `features.sms`).

**To the metal:** Programmable Messaging REST only.

| Use | Avoid (cost / complexity) |
|-----|---------------------------|
| `POST …/Messages.json` with **From** + **To** + **Body** | Twilio **Verify** product |
| One **local long code** From number | Messaging Service SID |
| Our own 6-digit OTP in the body | Conversations / Notify |
| No Twilio SDK (raw `fetch`) | Extra npm packages |

You pay **per outbound SMS segment** (+ number rental). That’s it.

## Workspace setup

0. Set a **paid plan** in the tenant declaration:

```yaml
# tenants/2x4m/bevel.yaml
plan: pro          # free | pro | team | enterprise
features:
  sms: true        # optional; defaults on for paid plans, always off for free
```

1. [Twilio Console](https://console.twilio.com/) → buy a **cheap local number** (SMS capable)
2. Copy **Account SID**, **Auth Token**, **From** (`+1…`)
3. BEVEL → **Preferences → Integrations → Twilio · Messages API**
4. Enable + paste three fields → **Save**
5. **Send test** to your phone

Free workspaces see an upgrade notice instead of credential fields.
APIs return **402** with `upgradeRequired: true` when the plan is free.

Secrets: `data/secrets/twilio/<tenant>.json` (gitignored).

### Env fallback (platform, optional)

```bash
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=…
TWILIO_PHONE_NUMBER=+1…
```

## OTP sign-in (mobile)

- Login → **Mobile** → we generate the code → send via **Messages API**
- Not Twilio Verify (saves Verify per-check fees)
- Email OTP uses Resend/SendGrid if set; otherwise dev log

`POST /api/auth/otp/send` `{ "channel": "sms", "destination": "+1…" }`

## True-sentience SMS

**Preferences → Notifications → SMS · true sentience**

- **Vote links off** (default for cost):  
  `BEVEL #general: preview. Reply Y=open S=later N=ack` ≈ **1 segment**
- **Vote links on**: short `Y/S/N` URLs (multi-segment — use when you need tappable links)

Inbound webhook (POST):

```
https://bevel.<workspace>.lvh.me/api/twilio/webhook?tenant=<slug>
```

Reply **Y** / **S** / **N** (or yes/snooze/ack).

## Cost tips

1. Local long code, not short code / toll-free unless you need them  
2. Keep bodies under **160 GSM-7** chars when you can  
3. Leave **vote links off** for presence pings  
4. Mentions/DMs only + grace minutes + quiet hours cut volume  
5. Dev without keys: SMS is **simulated** to the server log (free)

## Files

| Path | Role |
|------|------|
| `apps/web/src/lib/twilio/client.ts` | Messages REST only |
| `apps/web/src/lib/twilio/workspace-config.ts` | Per-tenant SID/token/from |
| `apps/web/src/app/api/twilio/*` | HTTP |
| `packages/auth/src/otp.ts` | Our OTP codes (not Verify) |
