# Design Tokens

CSS/theme token architecture — color, space, type, elevation — as the single source of visual truth.

## When to use

- Hard-coded hex / px / rem sprawl
- Theme (day-part) work
- Cross-app token alignment (2x4m CMYK / ui packages)

## Rules

- Prefer semantic tokens (`--ink`, `--surface`, `--muted`) over raw palette
- Day-part themes must keep contrast on dusk/night
- No one-off hex in feature PRs without token proposal
- Document token name, value, and usage

## Anti-patterns

- `text-gray-800` on dark themes without remap
- Mixing brand tokens with random Tailwind grays
- Shadow/border that disappear on night surfaces

## Output contract

```markdown
## Token Change — YYYY-MM-DD
**Package / app:** ...

### Adds / changes
| Token | Value | Use |

### Migrations
files / components

### Contrast check
day | dusk | night
```
