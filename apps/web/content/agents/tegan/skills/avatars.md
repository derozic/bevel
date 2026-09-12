# Fleet Avatars

Canonical agent marks for every Entity surface — fleet catalog, 2x4m, Bevel, org chart, chat.

## When to use

- New director or IC
- Avatar looks like a letter, photo, emoji, or Heroicon
- Two products render the same agent differently

## System: sticker glyph

One mark per agent. Not a portrait. Not an initial.

| Rule | Value |
|------|--------|
| Canvas | `120×120`, `viewBox="0 0 120 120"` |
| Plate | `rx="28"` rounded square, fill = registry `accent` |
| Ink | `#1a1410` only if contrast needs it; default glyph stroke `#fff` at `3` |
| Face | cream / tinted fill (`#faf8f5` or accent-10) |
| Motif | 1 object that reads the soul at 24px |
| Forbidden | emoji, photos, single-letter initials, isometric second system, CDN assets |

## Source of truth

1. File: `apps/web/public/avatars/<id>.svg`
2. Registry: `"avatar": "/avatars/<id>.svg"`
3. Copy the same file into any consumer (`2x4m/apps/agents/public/avatars/`)
4. UI: render the SVG as an image. Do not keep a parallel React-drawn set.

## Motif map

| Agent | Motif |
|-------|--------|
| hermes | winged head + caduceus flick |
| sterling | rising bars + coin |
| mildred | ledger + tally |
| cadence | beat bars / metronome |
| tegan | board + type marks |
| spark | crossing sparks |
| helm | ship's wheel |
| sable | dark screen + NFC chip |
| argus | nested eyes |
| atlas | stacked earth / load |
| portia | balanced scales |
| haven | harbor arch |
| veda | veil + key |
| rune | linked runes |
| grover | branching garden |
| flux | current / pipes |
| johnny | night lamp + green bead |
| brain | stacked pages |
| loom | weave |
| continuous | infinity loop |
| northstar | lighthouse star |
| lego | snapped bricks |
| codegraph | node graph |
| crucible | vessel + heat |

## Output contract

```markdown
## Avatar — <id>
- file: apps/web/public/avatars/<id>.svg
- accent: <hex from registry>
- motif: <one object>
- consumers synced: [agents web, 2x4m, …]
```
