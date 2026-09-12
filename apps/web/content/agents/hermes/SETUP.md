# Hermes first-time setup (fleet recommendation)

## Choose Full setup (bring your own keys)

When you run `hermes setup` for the first time, Hermes offers three paths:

1. **Quick Setup (Nous Portal)** — free OAuth, no API keys  
2. **Full setup** — configure every provider, tool & option yourself (**bring your own keys**)  
3. **Blank Slate** — minimum surface; opt in later  

### Derozic / BEVEL recommendation: **Full setup** (option 2)

For any Hermes that co-founds a real workspace (2x4m, preso, decli, BEVEL tenant, …):

- Prefer **Full setup** so you control OpenRouter (or other) keys, toolsets, gateway, and policies.  
- Aligns with fleet agents that already use `OPENROUTER_API_KEY` and product secret standards (1Password, no keys in git).  
- Portal quick setup is fine for **personal exploration** only — not the default for deployed workspaces.

```bash
hermes setup
# Select:
#   Full setup — configure every provider, tool & option yourself (bring your own keys)
```

There is no `--full` flag; pick the menu item. After the wizard:

```bash
hermes model          # confirm OpenRouter / coding models
hermes doctor
agents hermes skill-install   # bevel-workspace skill into this profile
```

---

## One Hermes or many?

The agents fleet supports **more than one Hermes**:

| Topology | When | Config |
|----------|------|--------|
| **Federated / central** | One co-founder Hermes across products | `mode: federated`, single `hermes` with `scope: central` |
| **Standalone / workspace** | Each product monorepo has its own Hermes + keys + memory | `mode: standalone`, `scope: workspace`, dedicated profile |
| **Hybrid** | Shared core fleet + per-tenant Hermes clones | `mode: hybrid`, list of instances (`hermes`, `hermes-2x4m`, …) |

### Federated (centralized)

```json
{
  "mode": "federated",
  "defaultAgents": ["hermes", "johnny"],
  "hermes": {
    "id": "hermes",
    "scope": "central",
    "setupPath": "full",
    "profile": "default",
    "skills": ["bevel-workspace"]
  }
}
```

### Standalone (unique per workspace)

```json
{
  "mode": "standalone",
  "defaultAgents": ["hermes"],
  "hermes": {
    "id": "hermes",
    "scope": "workspace",
    "setupPath": "full",
    "workspaceSlug": "2x4m",
    "profile": "2x4m",
    "projectPath": ".",
    "skills": ["bevel-workspace"]
  }
}
```

Create an isolated Nous profile, then Full setup:

```bash
hermes profile create 2x4m
hermes profile use 2x4m
hermes setup    # Full setup (BYOK)
```

### Hybrid (multi-tenant host)

```json
{
  "mode": "hybrid",
  "defaultAgents": ["hermes"],
  "hermes": [
    { "id": "hermes", "scope": "central", "setupPath": "full", "profile": "default" },
    {
      "id": "hermes-2x4m",
      "scope": "workspace",
      "setupPath": "full",
      "workspaceSlug": "2x4m",
      "profile": "2x4m",
      "projectPath": "../2x4m"
    },
    {
      "id": "hermes-preso",
      "scope": "workspace",
      "setupPath": "full",
      "workspaceSlug": "preso",
      "profile": "preso"
    }
  ]
}
```

Mention `@hermes-2x4m` for the product-specific co-founder; `@hermes` for the central peer.

---

## CLI helpers (agents repo)

```bash
agents hermes setup              # print Full-setup guidance + commands for this workspace
agents hermes setup --write      # write .agents/hermes-instances.json from fleet.json
agents hermes list               # list configured Hermes instances
agents hermes skill-install      # install bevel-workspace into active/profile HERMES_HOME
```

Script (profile + skill):

```bash
./scripts/hermes-workspace-setup.sh 2x4m
```

---

## Secrets

- Never commit API keys.  
- Prefer 1Password items per product (`2x4m OpenRouter`, `preso OpenRouter`).  
- Workspace-scoped profiles keep separate `~/.hermes` profile data so tenants do not share session memory or keys by accident.

---

## Related

- [INTEROP.md](./INTEROP.md) — BEVEL Desktop / CLI handoffs  
- [Official setup](https://hermes-agent.nousresearch.com/docs/getting-started/installation)  
- `hermes profile --help` — isolated instances on one machine  
