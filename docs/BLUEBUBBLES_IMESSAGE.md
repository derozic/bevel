# BEVEL · BlueBubbles (local Mac iMessage bridge)

iMessage outbound/inbound for invites and “you have a new BEVEL” pings.

**BlueBubbles runs only on macOS** (this laptop or a dedicated Mini).  
It does **not** install on the Linux EC2. Production Bevel (`bevel.is`) calls the Mac’s API over Tailscale / tunnel when needed.

## Architecture (local instance + live product)

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR MAC (always-on for iMessage)                          │
│                                                             │
│  Messages.app  ←── BlueBubbles Server (localhost:1234)      │
│       ▲                    │                                │
│       │                    │ REST + password                │
│  Apple ID auth             ▼                                │
│                     optional: local BEVEL web               │
│                     https://bevel.lvh.me  (:43200)          │
└────────────────────────────┬────────────────────────────────┘
                             │  HTTPS (Tailscale / Cloudflare)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  PRODUCTION (SoT for conversations)                         │
│  Postgres + api.bevel.is + realtime.bevel.is + bevel.is     │
│  Channel messages, tenants, handoff, push tokens            │
└─────────────────────────────────────────────────────────────┘
```

### Do we keep Bevel running locally?

**Yes** — for:

| Local process | Why |
|---------------|-----|
| Web (`bevel.lvh.me`) | UI / OAuth / claim testing |
| API (optional hybrid) | Prefer **production API** as message SoT (see below) |
| Realtime | Local if experimenting; prod for real chat |
| **BlueBubbles** | iMessage — key local function |

Silicon app and most operators should still hit **live** `api.bevel.is` / `bevel.is`.  
Local Bevel is the **dev + bridge host**, not a second product database.

### Conversation sync: local ↔ bevel.is

**Do not run two independent Postgres copies of the same workspace.**

| Mode | How | Sync |
|------|-----|------|
| **A. Prod SoT (recommended)** | Local web uses Caddy `.lvh.me` for Next, but `BEVEL_API_URL` / fleet / message writes go to `https://api.bevel.is` | One database — always “in sync” |
| **B. Local SoT** | Full local Postgres for experiments | **Not** synced to prod unless you export |
| **C. Dual-write (avoid)** | Write both local + prod | Race / drift / pain |

**Recommended while building:**

```bash
# Local UI
bash scripts/services.sh start

# Point control plane clients at LIVE API (conversations = production)
# in apps/web/.env.local or monorepo .env:
BEVEL_API_URL=https://api.bevel.is
NEXT_PUBLIC_BEVEL_API_URL=https://api.bevel.is
NEXT_PUBLIC_REALTIME_URL=https://realtime.bevel.is
FLEET_INTERNAL_API_KEY=<same as production>
```

Then:

- Chat history you see in product = **prod**  
- Local BlueBubbles only **notifies** people (side channel)  
- Replies on iMessage can later POST into **prod** channels via a webhook bridge  

Auth for local UI still uses `.lvh.me` cookies; production login stays on `bevel.is`.  
Cross-host product auth already uses handoff codes (`docs/PRODUCTION_AUTH.md`).

## Install BlueBubbles (this Mac)

1. App installed via Homebrew cask (or [DMG](https://bluebubbles.app/install/)):
   ```bash
   brew install --cask bluebubbles
   open -a BlueBubbles
   ```
2. Complete setup wizard:
   - Full Disk Access (required for Messages DB)
   - Accessibility (optional)
   - Firebase for push (can skip for server-only API use)
   - **Server password** — type it, then **click the floppy SAVE icon**  
     (if password is empty in the DB, every API call returns 401 “Missing server password”)
   - Save the same password to 1Password: **BEVEL BlueBubbles API**
3. Settings → **API** → note:
   - Server URL (e.g. `http://127.0.0.1:1234` or LAN/Tailscale)
   - Password
4. Sign into **iMessage** on this Mac with a **dedicated Apple ID** if possible.
5. Verify:
   ```bash
   # after password is saved in BlueBubbles UI:
   BLUEBUBBLES_PASSWORD='…' ./scripts/bluebubbles-check.sh
   # expect: GET /api/v1/ping … 200
   ```

### Hermes / agent prompt

When asked:

```text
BlueBubbles server URL (e.g. http://192.168.1.10:1234):
```

Answer with your reachable base URL, e.g.:

- Local only: `http://127.0.0.1:1234`
- From other machines / EC2: `http://100.x.y.z:1234` (Tailscale IP of this Mac)

Password is separate (1Password / env), never put it in the URL.

## Bevel env (local + production bridge)

```bash
# Local Mac (and optionally on EC2 if tunnel exists)
BLUEBUBBLES_URL=http://127.0.0.1:1234
BLUEBUBBLES_PASSWORD=...
# Optional: guide text for Hermes
BLUEBUBBLES_GUIDE_URL=https://bluebubbles.app/
```

Store password in 1Password: **BEVEL BlueBubbles API**.

## Send path (product)

```
New workspace invite / “you have Bevel”
  → Bevel notify router
       ├── SMS → Twilio (prod, paid plans)
       ├── Push → devices table
       └── iMessage → BlueBubbles POST /api/v1/message
              (from local Mac or tunneled from EC2)
```

Client: `apps/web/src/lib/bluebubbles/client.ts`  
Feature flag: `features.imessage` (tenant) + platform env.

## Security

- Prefer **Tailscale** over exposing BlueBubbles to the public internet  
- Dedicated Apple ID for the bridge  
- Rate-limit invites (Apple may lock accounts that spam)  
- Never commit passwords  

## Checklist

- [ ] BlueBubbles.app installed and running  
- [ ] Messages signed in  
- [ ] API password in 1Password  
- [ ] Local Bevel `scripts/services.sh start`  
- [ ] Optional: local env points API/realtime at **production** for shared conversations  
- [ ] Hermes BlueBubbles URL filled with `http://127.0.0.1:1234` or Tailscale  
- [ ] Test: send one iMessage to yourself from Bevel / API  

## Related

- SMS: [TWILIO_SMS.md](./TWILIO_SMS.md)  
- Auth hosts: [PRODUCTION_AUTH.md](./PRODUCTION_AUTH.md)  
- Local stack: `scripts/services.sh`  
