# BEVEL ↔ Hermes Desktop interop (macOS)

Deep integration between the **BEVEL** Flutter desktop app and **Hermes Desktop** (Nous Research), coordinated with fleet `@hermes` in `~/dev/agents`.

**Official guides:**

- [Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)
- [CLI](https://hermes-agent.nousresearch.com/docs/user-guide/cli)

## Ownership

| Concern | Repo |
|---------|------|
| Agent soul, skills, handoff schema, installable Hermes skill | `~/dev/agents` → `src/agents/hermes/` |
| macOS bridge, deep links, AX labels, Native Hub UI | `~/dev/bevel` → `apps/mobile/` |

Authoritative contract: `~/dev/agents/src/agents/hermes/INTEROP.md`.

## What official Desktop is

From Nous docs:

- **Same agent** as CLI/TUI/gateway: shared `HERMES_HOME` (`~/.hermes`) — config, keys, sessions, skills, memory.
- Packaged Electron app + React UI; backend is headless **`hermes serve`** (tui_gateway JSON-RPC/WebSocket), **not** the messaging gateway.
- Launch: install DMG **or** `hermes desktop` (uses existing install).
- Project folder: `hermes desktop --cwd <path>` or `HERMES_DESKTOP_CWD`.
- macOS bundle id: **`com.nousresearch.hermes`**.
- Skills/cron/profiles managed in-app; optional **desktop plugins** under `$HERMES_HOME/desktop-plugins/`.
- Optional **remote** backend: point Desktop at another host’s `hermes serve` (docs example port **9119**).

## What BEVEL does with that

1. **Open Hermes** from home, workspace chrome, Native Hub (Desktop **or** CLI)  
2. **Clipboard handoff** `BEVEL_HERMES_HANDOFF:` JSON v1 (`surface`, skills, prompt, channel, returnUrl, projectPath)  
3. **Launch by surface**  
   | surface | Behavior |
   |---------|----------|
   | `desktop` | `hermes desktop --cwd` → Hermes.app → CLI fallback |
   | `cli` | Terminal.app: `hermes -s bevel-workspace` |
   | `cli-query` | Detached `hermes -s bevel-workspace chat -q "…"` |
4. **Probe**  
   - Primary: `hermes serve` (`http://127.0.0.1:9119/api/status` — 401 counts as up)  
   - Secondary: messaging gateway `http://127.0.0.1:8642/health`  
5. **Deep links** into BEVEL: `bevel://hermes/open|return|status`  
6. **AX labels** for computer-use against the BEVEL window  

Native Hub buttons: **Desktop** · **CLI** · **CLI -q** · Probe.

## Code map

```
apps/mobile/lib/native/
  hermes_handoff.dart
  hermes_bridge.dart
  deep_links.dart
  native_capabilities.dart
apps/mobile/lib/ui/
  native_hub_page.dart
  workspace_shell.dart
apps/mobile/lib/main.dart
```

## Operator setup

```bash
# Hermes (if not installed)
# https://hermes-agent.nousresearch.com/docs/getting-started/installation

hermes desktop                    # GUI
hermes desktop --cwd ~/dev/bevel  # project-scoped Desktop session

# CLI (same HERMES_HOME)
hermes -s bevel-workspace
hermes -s bevel-workspace chat -q "Summarize and open bevel://hermes/return"
hermes -c                         # resume last CLI session

# Fleet skill → becomes /bevel-workspace slash command in CLI
~/dev/agents/scripts/install-hermes-bevel-skill.sh
```

Optional `~/.hermes/config.yaml` quick command:

```yaml
quick_commands:
  bevel-return:
    type: exec
    command: open 'bevel://hermes/return?status=done'
```

Then in BEVEL macOS: **Native integrations → Probe / Open Hermes**.

## Future: Desktop Plugin SDK

Deeper first-class UI (status bar, palette command “Open BEVEL channel”) can ship as:

`$HERMES_HOME/desktop-plugins/bevel/plugin.js`

See [Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk). That belongs in bevel (or a small shared package), not the fleet agent soul.

## Expanded fields (v1 additive)

Keep Dart `HermesHandoffV1` in lockstep with agents `handoff.ts` / `handoff.schema.json`:

| Field | Use |
|-------|-----|
| `successCriteria` | Done-when line for Desktop/CLI |
| `evidence` | Paths / PR URLs to collect on return |
| `fleetMessageId` | Channel message that triggered handoff |
| `projectPath` / `cwd` | `hermes desktop --cwd` |
| `surface` | `desktop` \| `cli` \| `cli-query` |

## Optional fleet return post

Build with:

```bash
flutter build macos \
  --dart-define=BEVEL_API_URL=https://api.bevel.is \
  --dart-define=FLEET_INTERNAL_API_KEY=… \
  --dart-define=BEVEL_FLEET_TENANT=2x4m
```

On `bevel://hermes/return`, BEVEL focuses the channel and best-effort POSTs a Hermes summary message via FastAPI fleet routes.

## QA checklist

- [ ] `hermes desktop` launches from terminal  
- [ ] Native Hub Probe shows app/CLI + serve status  
- [ ] Open Hermes copies handoff with channel + tenant + successCriteria  
- [ ] Prefers `--cwd` when `projectPath` / `~/dev/<repo>` exists  
- [ ] `open 'bevel://hermes/status'` focuses Hermes card  
- [ ] `open 'bevel://hermes/return?channel=general&status=done&summary=ok'` focuses channel  
- [ ] Fleet skill installed: `~/dev/agents/scripts/install-hermes-bevel-skill.sh`  
- [ ] `pnpm test` in agents (handoff tests)  
- [ ] `flutter test test/hermes_handoff_test.dart` in apps/mobile  

## Related

- Agents contract: `~/dev/agents/src/agents/hermes/INTEROP.md`  
- [NATIVE_INTEGRATIONS.md](./NATIVE_INTEGRATIONS.md)  
- [GITHUB.md](../GITHUB.md)  
- [Desktop docs](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)  
