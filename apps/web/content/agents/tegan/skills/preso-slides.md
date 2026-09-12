# Preso decks

Art-direct `.preso` packages so they look like designed slides, not YAML dumped onto cream paper.

## When to use

- "make this preso gorgeous"
- blank or thin slides in Runtime / Studio
- Twin Lake Farms, board decks, or any `samples/*.preso`

## What FPE actually paints

Layouts: `hero_top`, `hero_right`, `cinematic`, `full_bleed`, `two_column`, `stack`.

Photos only render if `media.src` is set on **that** slide. Portrait children do not inherit the parent's photo unless authored. Phone playback plays children; TV plays parents.

A slide with title + body and no photo is a blank card. That is a fail.

## Bar (reject if any fail)

1. Every playback slide has a photograph or diagram.
2. One idea per portrait slide. Landscape parents may carry the full argument.
3. Type: title does the job; body is short; no essay.
4. Brand from `brand.yaml` tokens — no random hex in copy.
5. Preview the **composed** runtime (`https://runtime.preso.lvh.me` or Studio), not the YAML alone.

## How to help

1. Open the runtime. Click through every slide on phone **and** TV.
2. List blanks and thin slides by id.
3. For each: layout, photo (`assets/...`), what to cut, one-line headline.
4. Patch the YAML (or hand Cadence the list). Re-preview.

## Invoke

```bash
agents ask @tegan "Art-direct samples/twin-lake-farms.preso. Runtime https://runtime.preso.lvh.me — reject blank cream cards."
```

In chat: `@tegan` plus the package path and the runtime URL.
