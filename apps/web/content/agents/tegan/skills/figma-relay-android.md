# Figma → Android (Google Relay)

**Owner:** @tegan (Director of Design)  
**Audience:** Designer → Android (Jetpack Compose) handoff  
**Status note:** Google **sunset Relay on 30 Apr 2025** ([relay.material.io](https://relay.material.io/)). Treat this skill as (1) historical workflow for remaining Relay packages, and (2) the standing design-to-Compose handoff bar for any successor tool.

## What Relay was

Google’s **Relay** bridged UI design and Android development:

| Piece | Role |
|--------|------|
| **Figma plugin** | Package design components as Relay UI packages (parameters, variants, content slots) |
| **Android Studio plugin** | Import packages and generate **Jetpack Compose** production-oriented code |
| **Sync path** | Design updates re-exported → re-imported so Compose stays aligned with Figma |

**Core purpose:** Streamline designer-to-developer handoff — not “export pretty screenshots,” but **componentized, parameterised UI** that maps cleanly to Compose.

## When Tegan owns this

Use this skill when:

- Someone asks about Figma → Android / Compose / Relay / “design packages”
- Reviewing whether a Figma file is **handoff-ready** for mobile Compose
- Defining design-system rules so codegen (Relay or successor) doesn’t trash craft
- Auditing generated Compose against tokens, a11y, and brand (Entity / product themes)

**Hand off:**

| Concern | Agent |
|---------|--------|
| App architecture, Gradle, CI | @cadence |
| Secrets / API tokens in Figma plugins | @veda |
| Product scope / platform priority | @helm |
| Revenue packaging of design systems | @sterling |

## Design-side readiness (Figma)

Before any package export (Relay or alternative):

1. **Components, not frames-as-pages** — one semantic component per reusable UI unit  
2. **Variants** map to Compose parameters (state, size, tone) — name them for code, not only design jargon  
3. **Auto-layout** / constraints that imply Column/Row/Box — avoid absolute soup  
4. **Text styles** and **color styles** bound to tokens (see `skills/tokens.md`)  
5. **Content slots** for developer-filled text/images — never hard-bake final copy into every instance  
6. **a11y** — contrast, tap targets ≥ 48dp equivalent, meaningful layer names for labels  
7. **No emoji** as UI chrome; icon components only (Heroicons / product icon set)  
8. **Local craft** — document what must stay hand-written in Compose (animation, complex gestures)

## Historical Relay workflow (if still in use)

```
Figma (component + Relay plugin)
  → UI package export
  → Android Studio (Relay plugin)
  → Generated Compose UI
  → App code binds parameters / navigation / data
```

### Figma plugin checklist

- Isolate the component set before packaging  
- Configure parameters (text, color, boolean, enums) for runtime binding  
- Export only stable, reviewed components  
- Version packages when API (parameters) change

### Android Studio checklist

- Install Relay plugin + project Relay Gradle integration (legacy projects)  
- Import UI packages into module  
- Treat generated files as **semi-generated** — extend via wrappers, don’t freehand-edit forever  
- Wire theme (Material / product theme) after import  
- Verify build flavors and resource packaging

## Craft bar for generated Compose (always applies)

Whether Relay or a successor produces the file, Tegan still rejects handoff that fails:

| Bar | Expectation |
|-----|-------------|
| Tokens | No hard-coded hex that fights design system |
| Type | Scale matches Figma text styles / theme typography |
| Space | 4/8 rhythm; no magic padding piles |
| a11y | Semantics, contentDescription, focus order |
| Motion | Spec’d or intentionally static (`skills/motion.md`) |
| Theme | Day-part / dark surfaces remain readable |
| Structure | Composables named after product components, not `Frame132` |

## Successors & alternatives (post-sunset)

When Relay is unavailable, keep the **same handoff contract**:

1. **Figma Dev Mode + component APIs** — document props for Compose authors  
2. **Design tokens export** (JSON/CSS → Compose `Color` / `TextStyle` theme objects)  
3. **Code Connect / Storybook-style mappings** where the stack supports them  
4. **Annotated handoff decks** — interaction notes + a11y + empty states  
5. **Small reference Compose** for complex patterns (written or reviewed by eng under @cadence)

Prefer **tokens + clear component contracts** over full-screen screenshot codegen.

## Output contract

```markdown
## Figma → Android Handoff — YYYY-MM-DD
**Product / surface:** ...
**Tooling:** Relay (legacy) | tokens + manual Compose | other: ...
**Risk:** high | medium | low

### Package / component inventory
| Figma component | Compose name | Parameters | Status |

### Design readiness
- [ ] Variants / props named for code
- [ ] Tokens bound
- [ ] a11y notes
- [ ] Empty / loading / error states

### Craft gaps (blocking)
1. ...

### Eng follow-ups (@cadence)
...

### Security notes (@veda)
Figma tokens / plugin secrets: ...
```

## Invocation examples

```bash
agents ask @tegan "Is this Figma button set ready for Compose handoff?"
agents ask @tegan "Relay is sunset — define our Figma→Android handoff standard without codegen"
agents ask @tegan "Review generated Compose from a design package against our tokens and a11y bar"
```

## Related skills

- `creative-direction` — overall craft and brand fit  
- `tokens` — semantic color/type/space  
- `accessibility` — WCAG / mobile target sizes  
- `motion` — what must not be lost in codegen  
- `brand` — multi-product consistency  
