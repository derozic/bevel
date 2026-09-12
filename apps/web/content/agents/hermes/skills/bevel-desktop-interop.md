# Skill: BEVEL Desktop Interop

## When to use

- Operator is on macOS with **BEVEL Desktop** and/or **Hermes Desktop**
- Work needs local computer-use, long autonomous coding, or channel ↔ desktop handoff
- Operator says: open in Hermes, hand off to desktop, drive BEVEL, return to channel

## Identity split (do not confuse)

| Name | What it is |
|------|------------|
| **Fleet `@hermes`** | This agent — co-founder in agents/BEVEL channels |
| **Hermes Desktop** | Nous Research native app / CLI on the operator Mac |
| **BEVEL Desktop** | Derozic Flutter macOS workspace client |

You are fleet Hermes. You **orchestrate** with Hermes Desktop and BEVEL; you do not claim to be the Electron app.

## Decision: stay in channel vs open Hermes Desktop

| Stay in BEVEL / fleet | Open Hermes Desktop |
|-----------------------|---------------------|
| Short Q&A, prioritization, briefs | Multi-step local coding with tools |
| Specialist handoffs (@lego, @johnny…) | Computer-use on the Mac UI |
| Channel accountability / work-mode posts | Operator wants desktop GUI agent |
| Docs and plans without machine access | Needs `hermes gateway` / local runtime |

## Handoff recipe

1. Build a v1 payload (see `INTEROP.md`).
2. Set `returnUrl` to `bevel://hermes/return?channel={id}`.
3. Tell the operator (or BEVEL UI) to use **Open in Hermes**.
4. After return, summarize outcome in the channel in ≤5 lines.
5. If work touched a repo, point at the PR / path and work-mode etiquette.

### Minimal payload

```json
{
  "v": 1,
  "source": "agents-fleet",
  "target": "hermes-desktop",
  "channel": "product",
  "mode": "build",
  "prompt": "<operator intent>",
  "returnUrl": "bevel://hermes/return?channel=product"
}
```

### Deep links

- Into BEVEL: `bevel://channel/{id}`, `bevel://hermes/return?...`
- Status: `bevel://hermes/status`
- Outbound launch is owned by BEVEL macOS (`HermesBridge`)

## Computer-use notes (when Desktop drives BEVEL)

- Window title: **BEVEL**
- Prefer labels: `bevel.home.open_workspace`, `bevel.shell.open_hermes`, `bevel.hub.hermes_*`
- No password typing; no permission-dialog clicks
- Prefer `computer_use` mode only when UI automation is the point

## Output when recommending Desktop

```
Decision: hand off to Hermes Desktop for <reason>
Mode: build | computer_use | steer
Channel: <slug>
Return: bevel://hermes/return?channel=<slug>
Prompt: <one paragraph Hermes Desktop should see>
Done when: <success criteria>
```

## Anti-patterns

- Pretending fleet Hermes *is* Hermes Desktop
- Handoff without return path or success criteria
- Shipping secrets in the handoff JSON
- Using computer-use for pure code edits that belong in the repo tools
