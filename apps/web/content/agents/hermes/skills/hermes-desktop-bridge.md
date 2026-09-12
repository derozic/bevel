# Skill: Hermes Desktop & CLI Bridge

## Purpose

Define how fleet Hermes partners with **Nous Hermes** front ends (Desktop + CLI) without identity collapse.

Official docs:

- [Desktop](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)
- [CLI](https://hermes-agent.nousresearch.com/docs/user-guide/cli)

## Partnership model

```
Operator
   │
   ├─► BEVEL channel ── @hermes (fleet) ── prioritizes / orchestrates
   │                         │
   │                         ├─ surface:desktop ──► Hermes Desktop
   │                         ├─ surface:cli ──────► Terminal `hermes -s bevel-workspace`
   │                         └─ surface:cli-query ► `hermes chat -q "…"`
   │                                      │
   │                         ◄── returnUrl / summary ─┘
   │
   └─► Hermes CLI / Desktop directly (skills, tools, sessions in ~/.hermes)
```

## Surfaces

| Surface | When to pick | Launch (operator / BEVEL) |
|---------|--------------|---------------------------|
| **desktop** | GUI, multi-chat, file browser, voice | `hermes desktop --cwd …` / Hermes.app |
| **cli** | Terminal-native, slash commands, live tools | `hermes -s bevel-workspace` |
| **cli-query** | Fire-and-forget one shot | `hermes -s bevel-workspace chat -q "…"` |

All share the same agent state under `~/.hermes` (sessions in SQLite; resume with `hermes -c` / `--resume <id>`).

## CLI patterns fleet Hermes should mention

```bash
hermes setup --portal          # first-time
hermes chat -q "…"             # non-interactive
hermes -s bevel-workspace      # preload BEVEL skill
hermes -c                      # continue last CLI session
hermes --tui                   # modern TUI
/background <prompt>           # parallel work inside a CLI session
/status                        # local session recap (no LLM)
```

Installed skills become slash commands: `/bevel-workspace` after skill install.

Optional quick command in `~/.hermes/config.yaml`:

```yaml
quick_commands:
  bevel-return:
    type: exec
    command: open 'bevel://hermes/return?status=done'
```

## What fleet Hermes owns

- Co-founder judgment in the channel
- Choosing surface (desktop vs cli vs cli-query)
- Handoff completeness: mode, prompt, skills, return channel
- Closing the loop after return

## What Nous Hermes owns

- Local tools (terminal, files, browser, computer-use)
- Skills, cron, profiles under `~/.hermes`
- CLI TUI + Desktop GUI + optional messaging gateway

## Bridge rules

1. **One mission, two runtimes** — pick a primary executor.
2. **Handoff is explicit** — mode, surface, prompt, return path.
3. **Preload BEVEL skill** — always prefer `-s bevel-workspace` when launching CLI.
4. **Status is short** on return — not a full transcript dump.
5. **Identity** — fleet `@hermes` ≠ Nous CLI binary ≠ Desktop Electron shell.

## Detection language

| Operator says | Prefer |
|---------------|--------|
| Hermes app / Desktop / GUI | `surface: desktop` |
| terminal / CLI / TUI / slash commands | `surface: cli` |
| one-shot / quiet query / batch | `surface: cli-query` |
| computer use / cua-driver | desktop or CLI with computer_use toolset |

## Success criteria template

```
Mission:
Primary executor: fleet | hermes-desktop | hermes-cli
Surface: desktop | cli | cli-query
Skills: bevel-workspace
Return channel:
Evidence required:
```
