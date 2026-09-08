# Google Messages on Android — pervasive comms, life KB, timeline

SMS is a bad chat product and a uniquely good **life archive**. Almost
everyone still has a number. The messages that matter — hospital, landed,
born, died, job, eviction — still arrive as gray bubbles next to OTPs.

BEVEL does **not** clone Google Messages. It treats that inbox the way we
treat iMessage on the Mac:

| Layer | What it is | What it is not |
|-------|------------|----------------|
| **Pervasive comms** | Optional agent prompt on *your* number | Twilio (Bevel-owned, paid) |
| **Knowledge base** | Local search over the SMS you already have | Uploading the inbox to an org channel |
| **Life timeline** | Heuristic “moments” → personal Bevel timeline | A second Messages.app |

RCS stays inside Google Messages. There is no third-party RCS API. We
read the **system SMS provider** that Messages writes to.

## Why this is the Android parallel of iMessage

iMessage on Silicon = Apple’s pervasive 1:1 fabric.  
Google Messages / SMS on Android = the same job for everyone else.

Both are:

- **Ineffective** as a product (no agents, no search that matters, no
  workspace)
- **Pervasive** as infrastructure (the number you give the hospital)
- A **lossy but honest timeline** of what actually happened to you

BEVEL’s job is to keep the pervasiveness and throw away the product.

## Three surfaces (all opt-in)

### 1. Comms — agents can text this phone

Native Hub → **Google Messages · SMS** → Grant SMS → **Enable**.

Off by default. Uses `SmsManager` + `RECEIVE_SMS`. Same pattern as
Mac AppleScript send.

### 2. Knowledge base — search the archive locally

`searchInbox` runs on-device against `content://sms`. Keyword, handle,
date. Crazy-fast because it never leaves the phone. This is the FTS
equivalent of the iMessage inbox index.

OTPs, short codes, and “reply STOP” are classified as **noise** and
dropped from any “what mattered” view.

### 3. Timeline — approximation of what really mattered

`scanLifeMoments` walks recent SMS and keeps only **life** / **critical**
rows:

- critical: hospital, 911, passed away, funeral, labor, accident
- life: just landed, job offer, laid off, evicted, engaged, deployed

Those can be upserted to the **personal** Bevel timeline only:

```
POST /api/v1/ingest/life-moments
```

- `kind=sms`, `source_type=sms`, `source_id=<sms row id>`
- **No workspace channel write**
- Deduped per owner
- Agents recall this as *your* life, not the company’s `#general`

## Isolation (same two-corpus rule as iMessage)

| Corpus | Who sees it |
|--------|-------------|
| Bound thread (future) | Workspace members of that room, after explicit bind |
| Life index + timeline | **Only the Android’s signed-in Bevel user** |

## Code

```
apps/mobile/android/.../SmsHostChannel.kt   # telephony send/read/search/scan
apps/mobile/lib/native/sms_host_bridge.dart
apps/mobile/lib/native/sms_life_index.dart  # noise vs life vs critical
services/api/.../routers/ingest.py          # POST /api/v1/ingest/life-moments
```

## Related

- [IMESSAGE.md](./IMESSAGE.md) — Mac counterpart
- [TWILIO_SMS.md](./TWILIO_SMS.md) — different number, different product
- [NATIVE_INTEGRATIONS.md](./NATIVE_INTEGRATIONS.md)
