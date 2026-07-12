# BEVEL app icon — Icon Composer pipeline

Goal: **award-tier** mark across iOS, Android adaptive, and macOS dock.

## Sources

| File | Role |
|------|------|
| `bevel-icon-master.svg` | Layered vector master (import into Icon Composer) |
| `icon-composer.json` | Layer roles + palette + quality bar |
| `bevel-icon-1024.png` | Marketing / iOS single-size source |
| `bevel-icon-fg-1024.png` | Android adaptive **foreground** |
| `bevel-icon-mono-1024.png` | Android **monochrome** (themed icons) |

## Apple Icon Composer

1. Open **Icon Composer** (bundled with recent Xcode) or create an Icon set in the asset catalog.
2. Import layers from `bevel-icon-master.svg` back → front as listed in `icon-composer.json`.
3. Assign lighting groups so the green **accent edge** catches specular light.
4. Export to `ios/Runner/Assets.xcassets/AppIcon.appiconset` (and macOS twin).
5. Prefer a layered `.icon` / asset catalog over a flat raster when targeting latest iOS.

## Flutter raster generation

```bash
cd apps/mobile
dart run flutter_launcher_icons
```

Uses `flutter_launcher_icons` config in `pubspec.yaml` (background `#0A0E12`, FG + mono layers).

## Quality checklist

- [ ] Legible B at notification size
- [ ] Circular / squircle masks do not clip the accent edge
- [ ] Dark and light home screens both work
- [ ] No transparency on iOS marketing 1024 (App Store)
- [ ] Distinct from generic green chat bubbles
