# Hermes ↔ BEVEL Desktop Interop

Contract for valuable interaction between:

1. **Fleet Hermes** (`@hermes` in this repo / BEVEL channels)
2. **Hermes Desktop** (Nous Research native macOS app + CLI)
3. **BEVEL Desktop** (Flutter macOS app at `~/dev/bevel/apps/mobile`)

## Ownership split

| Surface | Repository | Owns |
|---------|------------|------|
| Agent soul, skills, routing, fleet handoffs, interop contract | `~/dev/agents` | Hermes identity + when/how to use BEVEL / Hermes Desktop |
| macOS app bridge, deep links, AX labels, gateway probe, open Hermes | `~/dev/bevel` | Runtime interoperability on the Mac |

## Goals

- Operator can hand work from a BEVEL channel into Hermes Desktop for local computer-use / deep coding without retyping context.
- Hermes Desktop (or fleet `@hermes`) can open the right BEVEL channel and leave an accountability trail.
- Both apps share one handoff payload schema so clipboard, deep links, and gateway paths stay compatible.

## Handoff payload (v1)

JSON object, UTF-8. May travel as:

- Query params on `bevel://` URLs (prompt URL-encoded; large prompts use clipboard + short deep link)
- Clipboard MIME `public.utf8-plain-text` with a `BEVEL_HERMES_HANDOFF:` prefix line
- Optional POST body when Hermes gateway is local

```json
{
  "v": 1,
  "source": "bevel",
  "target": "hermes-desktop",
  "tenant": "2x4m",
  "channel": "product",
  "workspaceUrl": "https://2x4m.bevel.lvh.me/bevel/product",
  "returnUrl": "bevel://hermes/return?channel=product",
  "repo": "derozic/agents",
  "agentId": "hermes",
  "sessionId": "optional-colyseus-or-fleet-id",
  "mode": "build",
  "prompt": "Implement the health probe and open a PR.",
  "constraints": {
    "workMode": true,
    "noDocker": true,
    "useCaddy": true
  },
  "createdAt": "2026-07-24T12:00:00.000Z"
}
```

### Fields

| Field | Required | Notes |
|-------|----------|--------|
| `v` | yes | Schema version; currently `1` |
| `source` | yes | `bevel` \| `agents-fleet` \| `hermes-desktop` |
| `target` | yes | `hermes-desktop` \| `bevel` \| `agents-fleet` |
| `tenant` | no | Tenant slug when known |
| `channel` | no | Channel id / slug (e.g. `product`) |
| `workspaceUrl` | no | Full HTTPS URL operator can open |
| `returnUrl` | no | Prefer `bevel://hermes/return?...` |
| `repo` | no | `owner/repo` for work mode |
| `projectPath` / `cwd` | no | Absolute path → `hermes desktop --cwd` / CLI working dir |
| `surface` | no | `desktop` \| `cli` \| `cli-query` (default `desktop`) |
| `skills` | no | Skill names for `hermes -s a,b` (default `["bevel-workspace"]`) |
| `agentId` | no | Default `hermes` |
| `sessionId` | no | Fleet / Colyseus session id |
| `mode` | no | `steer` \| `build` \| `orchestrate` \| `brief` \| `computer_use` |
| `prompt` | no | Operator intent |
| `successCriteria` | no | Short “done when” line for Desktop/CLI |
| `evidence` | no | Paths / PR URLs to collect on return |
| `fleetMessageId` | no | Channel message that triggered handoff |
| `constraints` | no | Product rules (no Docker, Caddy, etc.) |
| `createdAt` | no | ISO-8601 |

JSON Schema: `src/agents/hermes/handoff.schema.json` (keep Dart model in lockstep).

## Deep links

### Into BEVEL (macOS / iOS)

| URL | Behavior |
|-----|----------|
| `bevel://channel/{id}` | Open workspace channel |
| `bevel://hermes/open?prompt=&channel=&mode=&repo=` | Store handoff, open channel, surface Hermes status card |
| `bevel://hermes/return?channel=&status=&summary=` | Return from Hermes Desktop; show summary toast / channel focus |
| `bevel://hermes/status` | Open Native Hub focused on Hermes bridge |
| `bevel://agent/hermes` | Alias → open channel with `@hermes` focus path |

### Out of BEVEL → Hermes (Desktop or CLI)

**`surface: desktop`** (default):

1. `hermes desktop --cwd <projectPath>` when CLI + cwd resolve  
2. Packaged app: `open -a Hermes.app` / `com.nousresearch.hermes`  
3. Fall back to interactive CLI if Desktop fails  

**`surface: cli`**:

1. macOS Terminal.app: `hermes -s bevel-workspace` (optional `cd` to projectPath)  
2. Handoff JSON still on clipboard for paste  

**`surface: cli-query`**:

1. Detached `hermes -s bevel-workspace chat -q "<prompt>"` ([CLI single-query mode](https://hermes-agent.nousresearch.com/docs/user-guide/cli))  

No public custom URL scheme for injecting prompts into Desktop; launch + clipboard + `--cwd` / `-s` / `-q` are the supported surfaces.

### Optional operator quick command (CLI)

In `~/.hermes/config.yaml` (see CLI quick commands):

```yaml
quick_commands:
  bevel-return:
    type: exec
    command: open 'bevel://hermes/return?status=done'
```

Then `/bevel-return` from Hermes CLI returns focus to BEVEL.

## Local backends (optional) — official Desktop architecture

From [Hermes Desktop docs](https://hermes-agent.nousresearch.com/docs/user-guide/desktop):

| Process | Role | Typical probe |
|---------|------|----------------|
| **`hermes serve`** | Desktop chat backend (`tui_gateway` JSON-RPC/WebSocket). Packaged app starts this for you. Remote example: `--port 9119` | `GET http://127.0.0.1:9119/api/status` (401 still means up) |
| **`hermes gateway`** | Messaging channels (Telegram, Discord, …). **Separate** from desktop chat | `GET http://127.0.0.1:8642/health` (OpenAI-compatible API server path) |

BEVEL Native Hub:

- Primary badge: **serve online** (`hermes serve` / :9119)
- Secondary: messaging gateway if :8642 answers

### Official front ends (shared `HERMES_HOME`)

| Surface | Docs | BEVEL handoff `surface` |
|---------|------|-------------------------|
| **Desktop app** | [Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop) | `desktop` (default) |
| **CLI** (classic TUI) | [CLI](https://hermes-agent.nousresearch.com/docs/user-guide/cli) | `cli` interactive Terminal |
| **CLI single-query** | same | `cli-query` → `hermes chat -q "…"` |
| **Modern TUI** | [TUI](https://hermes-agent.nousresearch.com/docs/user-guide/tui) | `hermes --tui` (operator; optional later) |

Preferred launch:

```bash
# Desktop GUI
hermes desktop --cwd /path/to/project

# Interactive CLI with BEVEL skill preloaded
hermes -s bevel-workspace
hermes -s bevel-workspace chat -q "Implement the health probe"

# Resume last CLI session
hermes -c
hermes --resume <session_id>
```

Skill install makes `/bevel-workspace` a **slash command** in CLI (every skill under `~/.hermes/skills/` auto-registers).

Env / resolution (Desktop docs):

- `HERMES_DESKTOP_CWD` — initial project directory  
- `HERMES_DESKTOP_HERMES_ROOT` — Hermes source root  
- `HERMES_DESKTOP_HERMES` — explicit hermes binary  
- `HERMES_DESKTOP_IGNORE_EXISTING` — ignore PATH hermes during backend resolution  
- `HERMES_DESKTOP_REMOTE_URL` — attach to remote `hermes serve`  
- macOS bundle id: `com.nousresearch.hermes`  
- Shared state: `HERMES_HOME` (`~/.hermes`) — same config, keys, sessions, skills as CLI  

**Desktop plugins** (deeper UI interop later): `$HERMES_HOME/desktop-plugins/<id>/plugin.js` — [Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk).

No secrets are sent to local backends from BEVEL without an explicit operator action.

## Modes → Hermes Desktop behavior

| Mode | Hermes Desktop should |
|------|------------------------|
| `steer` | Prioritize / decide; no heavy file edits |
| `build` | Coding session; pareto / coding models |
| `computer_use` | Drive BEVEL macOS UI via accessibility (no-foreground) |
| `orchestrate` | Plan fleet handoffs; post status back to channel |
| `brief` | Short status only; return via `returnUrl` |

## Computer-use against BEVEL

When Hermes Desktop drives BEVEL:

1. Prefer accessibility tree over raw pixels (`mode="ax"` when vision is weak).
2. Target windows titled **BEVEL**.
3. Use Semantic labels shipped in the Flutter client (`bevel.*` prefixes).
4. Never click permission dialogs or type secrets.
5. After meaningful work, open `returnUrl` or post to the channel with a one-line summary.

### Stable AX labels (BEVEL)

| Label | Control |
|-------|---------|
| `bevel.home.open_workspace` | Open workspace CTA |
| `bevel.home.native_hub` | Native integrations |
| `bevel.home.open_hermes` | Handoff to Hermes Desktop |
| `bevel.hub.hermes_card` | Hermes connection card |
| `bevel.hub.hermes_probe` | Re-probe Hermes |
| `bevel.hub.hermes_open` | Launch Hermes |
| `bevel.shell.share` | Share current workspace URL |
| `bevel.shell.open_hermes` | Hand current page to Hermes |

## Installable Hermes Desktop skill

Ship path in agents repo:

```
src/agents/hermes/hermes-skills/bevel-workspace/SKILL.md
```

Install into Hermes home (operator or script):

```bash
mkdir -p ~/.hermes/skills
ln -sfn ~/dev/agents/src/agents/hermes/hermes-skills/bevel-workspace \
  ~/.hermes/skills/bevel-workspace
```

## Fleet Hermes responsibilities

When `@hermes` is invoked inside BEVEL or agents fleet:

1. Own the outcome (co-founder stance).
2. Prefer **in-channel** work for fleet orchestration.
3. Escalate to **Hermes Desktop** when the task needs local computer-use, long autonomous loops, or operator-desktop context.
4. Always leave a return path (`returnUrl` or channel summary).
5. Log work-mode activity per BEVEL GitHub accountability rules when repos are involved.

## Security

- Handoffs never include API keys, tokens, or `.env` contents.
- Localhost gateway probes only; no remote Hermes endpoints by default.
- Operator must approve computer-use destructive actions (Hermes Desktop policy).
- Sandboxed BEVEL may only reach `127.0.0.1` for health checks (network client entitlement already present).

## Versioning

Bump `v` when fields break. Add optional fields without bumping. Document changes here and in `docs/HERMES_DESKTOP.md` (bevel).
