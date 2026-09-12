---
name: bevel-workspace
description: Work with BEVEL Desktop and fleet channels from Hermes Desktop. Use when the operator mentions BEVEL, bevel:// links, fleet channels, @hermes handoffs, or returning status to a workspace channel.
version: 1.1.0
---

# BEVEL Workspace (Hermes Desktop skill)

You are running inside **Hermes Desktop / CLI** (Nous). BEVEL is a separate multi-tenant workspace for humans and agents. Fleet `@hermes` may hand work to you with a JSON payload.

## When this skill applies

- Operator or handoff mentions BEVEL, `bevel://`, channels, tenants, work mode
- Clipboard starts with `BEVEL_HERMES_HANDOFF:`
- Task is "return to the channel" or "open BEVEL"
- Invoked as slash command `/bevel-workspace` (CLI auto-registers installed skills)

## CLI launch (official)

```bash
hermes -s bevel-workspace
hermes -s bevel-workspace chat -q "Ship the handoff return to BEVEL"
hermes -c   # resume last CLI session
```

Docs: https://hermes-agent.nousresearch.com/docs/user-guide/cli

## Handoff payload (v1)

Expect JSON (possibly after the prefix line `BEVEL_HERMES_HANDOFF:`):

| Field | Use |
|-------|-----|
| `prompt` | Primary task |
| `mode` | `steer` / `build` / `orchestrate` / `brief` / `computer_use` |
| `surface` | `desktop` / `cli` / `cli-query` |
| `channel` | Channel slug to return to |
| `workspaceUrl` | HTTPS workspace URL |
| `returnUrl` | Prefer opening this when done |
| `projectPath` / `cwd` | Repo path for `hermes desktop --cwd` |
| `successCriteria` | Done-when line |
| `repo` | GitHub `owner/repo` if work mode |
| `constraints` | Product rules (often no Docker; use Caddy; PostgreSQL) |

## Modes

| Mode | Do this |
|------|---------|
| `steer` | Decide and prioritize; minimal file changes |
| `build` | Implement in the repo; evidence for commands |
| `computer_use` | Drive the **BEVEL** macOS window via accessibility |
| `orchestrate` | Plan; do not steal specialist work without need |
| `brief` | Short status only; open `returnUrl` |

## Opening BEVEL

Prefer deep links (macOS `open`):

```bash
open 'bevel://channel/product'
open 'bevel://hermes/return?channel=product&status=done&summary=PR%20ready'
open 'bevel://hermes/status'
```

HTTPS fallback when the app is not installed:

- Use `workspaceUrl` from the payload, or the operator's tenant host (e.g. `https://2x4m.bevel.lvh.me`).

## Computer-use against BEVEL

1. Capture / AX on the window titled **BEVEL**.
2. Prefer these labels:
   - `bevel.home.open_workspace`
   - `bevel.home.open_hermes`
   - `bevel.hub.hermes_card`
   - `bevel.hub.hermes_probe`
   - `bevel.shell.share`
   - `bevel.shell.open_hermes`
3. Do not click OS permission dialogs or type secrets.
4. After work, open `returnUrl` or `bevel://hermes/return?channel=...&status=done&summary=...`.

## Product constraints (default for Derozic tenants)

Unless the operator overrides:

- No Docker / containerization for app runtime
- PostgreSQL only (no SQLite fallbacks)
- Caddy for local HTTPS (`.lvh.me`); never recommend bare `localhost:PORT` as the product URL
- pnpm for Node; uv for Python
- Agent work in git should follow BEVEL work-mode accountability when linked

## Return summary shape

When closing a handoff, keep it short:

```
Status: done | blocked | needs-human
Channel: <slug>
What shipped:
Evidence:
Next:
```

Then open the return deep link so BEVEL Desktop can focus the channel.

## Do not

- Confuse yourself with fleet channel agents beyond the handoff mission
- Paste API keys into BEVEL messages
- Invent BEVEL admin credentials
- Kill the machine-wide Caddy instance to "fix" a single project
