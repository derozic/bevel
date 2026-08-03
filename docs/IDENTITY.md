# BEVEL identity model (canonical)

Not patchy. One story:

```
Person (email) ── apex bevel.is
    │
    ├── always: Private  (/me · agents only)
    │
    └── memberships.yaml → product workspaces
            2x4m · decli · preso · olimbic · …
```

## Rules

1. **Person** = Google email at **bevel.is** (profile, primary agent, AI prefs).
2. **Private** is always available after login — no org required.
3. **Workspace** = explicit membership (`tenants/memberships.yaml` + optional tenant allowlists).
4. **Apex login always opens the Space chooser** (`/workspaces`): Private + every membership.
5. **No silent handoff** from domain defaults (`default_for_domains` does not pick your home).
6. Same person can be admin on many workspaces; isolation tests use separate memberships, not a different product rule.

## Files

| File | Role |
|------|------|
| `tenants/memberships.yaml` | Operator roster: email → [{ workspace, role }] |
| `tenants/*/bevel.yaml` `auth` | Optional closed-org gates / claim allowlists |
| `/workspaces` | Chooser UI |
| `/me` | Private agents shell |

## Adding an admin to more products

Edit `tenants/memberships.yaml`:

```yaml
people:
  scott@derozic.com:
    - workspace: 2x4m
      role: admin
    - workspace: decli
      role: admin
    - workspace: preso
      role: admin
```

Redeploy / reload tenant registry — no need to invent a unique Gmail per product.
