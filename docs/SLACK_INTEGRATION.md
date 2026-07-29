# BEVEL · Slack deep integration

**Stance:** complement Slack — do not clone it. Learn Slack’s best patterns (channels, threads, Block Kit, Events, slash commands, App Home, Workflows) and implement the *agent-native* equivalents better in BEVEL, while bridging where teams already live.

References:

- [Slack CLI](https://docs.slack.dev/tools/slack-cli) (install / authorize / manage apps)
- [Slack API](https://api.slack.com/) · Events API · OAuth v2 · Bolt / Deno Slack SDK

---

## Product positioning

| | **Slack** | **BEVEL** |
|--|-----------|-----------|
| Core | Human org HQ, density, enterprise presence | Humans **+ agents**, programs, Hermes, work channels |
| Best at | DMs, people search, corporate notifications, Workflow Builder | Agent dispatch, fleet handoffs, channel-as-product, local Silicon + iMessage |
| Risk if we “compete” | We become a worse Slack | We ignore where decisions already happen |

**Bridge principle:** BEVEL is the *work + agents* plane; Slack is the *people + broadcast* plane. Connect them so:

1. Important BEVEL activity can **land in Slack** (digest, @mention, agent done).  
2. High-signal Slack moments can **enter BEVEL** (optional channel mirror, ticket from thread).  
3. Operators **auth once** via Extensions (web or CLI) — same credential model as Twilio/GitHub.

---

## What we learn from Slack (and do better)

| Slack pattern | Learn | BEVEL equivalent (better) |
|---------------|--------|---------------------------|
| `#channels` + `^` culture | Named shared rooms | Public short paths + display `^slug` (URL-safe `/c/slug`) |
| Threads | Async depth without noise | Thread + agent session binding + evidence return |
| Reactions | Lightweight ack | Reaction → agent / workflow triggers |
| Slash commands | Muscle memory | `/bevel` slash in Slack + native cmdk in BEVEL |
| App Home | App-owned surface | Console + Native Hub + workspace home |
| Block Kit | Structured interactive messages | Typed message blocks + agent chips (already realtime-client) |
| Events API | Real-time side effects | Colyseus rooms + program events + fleet |
| Socket Mode | Local/dev without public URL | Local `.lvh.me` + optional Socket Mode for bridge |
| Workflows / Automation | No-code ops | Agent programs + n8n + BEVEL workflows console |
| CLI (`slack`) | Ship apps from terminal | `bevel integrations slack …` + Slack CLI for app lifecycle |

---

## Integration surfaces (phased)

### Phase 0 — Foundation (this PR scaffold)

- [x] Strategy doc  
- [x] Schema: `integrations.slack`  
- [x] Secret store: `data/secrets/slack/<tenant>.json`  
- [x] OAuth start/callback + status/disconnect/test  
- [x] Events webhook stub (URL verification)  
- [x] Console Integrations: real connect flow for Slack  
- [x] CLI: `bevel integrations slack status|connect|disconnect|test|mcp-config`  
- [x] **Slack MCP** — docs + client config (`docs/SLACK_MCP.md`, `GET /api/integrations/slack/mcp`)

### Phase 1 — Outbound (complement)

| Direction | Behavior |
|-----------|----------|
| BEVEL → Slack | Post channel digests, “agent finished”, claim invites, status |
| Formatting | Block Kit cards with deep links to `bevel.*` hosts |
| Routing | Map `^product` → Slack `#eng-product` (configurable) |

### Phase 2 — Inbound (learn + capture)

| Direction | Behavior |
|-----------|----------|
| Slack → BEVEL | Slash `/bevel status`, `/bevel open #general` |
| Mentions | `@BEVEL` bot → fleet/agent handoff |
| Optional mirror | Selected Slack channel ↔ BEVEL channel (not full history dump) |

### Phase 3 — Automation depth

| Tooling | Role |
|---------|------|
| **Slack CLI** | Create/deploy Slack apps, manage triggers (`slack login`, `slack create`, `slack deploy`) |
| **Bolt / Deno SDK** | Host automation functions next to BEVEL or as separate worker |
| **BEVEL Extensions** | Single UX: connect Slack, map channels, scopes, health |

---

## Auth model (Extensions)

### Web (bevel.is console / workspace prefs)

1. Operator opens **Console → Integrations → Slack** (or Preferences).  
2. **Connect with Slack** → OAuth v2 (`user` + `bot` tokens as needed).  
3. Callback stores tokens server-side (never client).  
4. Status shows workspace name, bot user, scopes, last event.

Env (platform):

```bash
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_REDIRECT_URI=https://bevel.is/api/integrations/slack/oauth/callback
# local:
# SLACK_REDIRECT_URI=https://bevel.lvh.me/api/integrations/slack/oauth/callback
```

### Terminal

```bash
# Option A — BEVEL CLI (workspace-aware)
bevel integrations slack status
bevel integrations slack connect          # prints OAuth URL or uses device flow
bevel integrations slack test "#general" "hello from BEVEL"
bevel integrations slack disconnect

# Option B — Slack’s own CLI for app lifecycle
# https://docs.slack.dev/tools/slack-cli
slack login
slack create                          # scaffold Bolt/Deno app if we ship automation
slack app list
```

BEVEL owns **workspace connection**; Slack CLI owns **Slack app shipping**. Operators may use both.

### Scopes (start minimal, expand)

**Bot (recommended baseline):**

- `chat:write`, `chat:write.public`
- `channels:read`, `groups:read`
- `commands` (slash)
- `app_mentions:read`
- `im:write` (optional DMs)
- `users:read` (map people carefully)

**Events:** `app_mention`, `message.channels` (opt-in), `app_home_opened`

**Socket Mode:** optional for local bridge without public Events URL.

### Token rotation (required for production)

Follow [Using token rotation](https://docs.slack.dev/authentication/using-token-rotation/).

1. In the Slack app → **OAuth & Permissions** → enable **Token Rotation**  
   (cannot be turned off once on — test in a dev app first).  
2. New installs return:
   - `access_token` (expires in **12 hours** / `expires_in: 43200`)
   - `refresh_token` (one-time use; store securely, replace on every refresh)
3. BEVEL stores bot + user pairs under `data/secrets/slack/<tenant>.json`:
   - `botToken` / `botRefreshToken` / `botTokenExpiresAt`
   - `userToken` / `userRefreshToken` / `userTokenExpiresAt`
4. Before API calls, `getValidBotToken()` / `getValidUserToken()` refresh when within **1 hour** of expiry via:

   ```http
   POST https://slack.com/api/oauth.v2.access
   grant_type=refresh_token&refresh_token=xoxe-1-…&client_id=…&client_secret=…
   ```

5. Migrating an old long-lived install after enabling rotation:

   ```bash
   # signed-in session cookie
   curl -X POST https://bevel.is/api/integrations/slack/rotate \
     -H 'Content-Type: application/json' \
     -d '{"action":"migrate"}'
   ```

   That calls `oauth.v2.exchange`. **Do not** `auth.revoke` the old token yourself.

6. Force refresh: `POST /api/integrations/slack/rotate` `{ "action": "refresh" }`

**App manifest** (new apps):

```yaml
settings:
  token_rotation_enabled: true
```

---

## Data & privacy

- Tokens: `data/secrets/slack/<tenant>.json` (gitignored) or AWS Secrets Manager in prod.  
- Prefer **bot** posts; user tokens only when “act as me” is explicit.  
- Never mirror private Slack DMs by default.  
- Audit: who connected, scopes, last post/event.

---

## Slack MCP (agents)

Hosted by Slack at **`https://mcp.slack.com/mcp`**. Agents search/send with **user OAuth**.

See **[SLACK_MCP.md](./SLACK_MCP.md)**. CLI: `bevel integrations slack mcp-config`.

## Relationship to other bridges

| Bridge | Role |
|--------|------|
| Twilio SMS | Phone / SMS true-sentience |
| BlueBubbles iMessage | Local Mac → Apple users |
| Slack Web API | Deterministic bot posts from BEVEL |
| Slack MCP | Agent search/send with user context |
| GitHub | Work mode / ^product |

Notify router (future): `channel → [sms | imessage | slack | push]`.

---

## Success criteria

1. Connect Slack from **console or CLI** in under 2 minutes.  
2. Post a BEVEL agent completion to a mapped Slack channel.  
3. Slash `/bevel open` returns a deep link into the Silicon/web app.  
4. No 2x4m (or any customer) branding leakage on platform-level Slack app install docs.  
5. Clear story: *“Slack for people density; BEVEL for agents and work channels.”*

---

## Non-goals (near term)

- Full Slack client replacement  
- Syncing all Slack history into Postgres  
- Replacing Slack Huddles (we have WebRTC huddles on Silicon path)  
- Free-plan mass spam into Slack workspaces  
