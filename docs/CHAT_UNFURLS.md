# Chat images and first-party unfurls

Thread attachments and pasted links follow the Magenta envelope: type the object first, fail closed, never treat a crawler scrape as the product.

## SVG

PNG, JPEG, WebP, GIF, and SVG all attach the same way (`![alt](/api/chat/images/…)`), and the thread always renders them as `<img src>`. SVG is never inlined as HTML.

Upload path (`POST /api/chat/images`):

1. Auth required.
2. Size cap **512 KB** for SVG (8 MB for rasters).
3. `sanitizeSvg` whitelist-lints the markup: allowed geometry tags only; strips `script`, event handlers, `foreignObject`, `javascript:` / `data:` URLs, and non-fragment `href` / `xlink:href`.
4. Fail closed — a dirty file is a 400, not a salvaged write.

GET path (`GET /api/chat/images/:filename`):

- `image/svg+xml` with `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'none'; sandbox`

Same-origin filename regex is the only src the client will lift out of markdown (`8–40` hex chars + extension).

## Unfurls

`GET /api/link-preview?url=` scrapes Open Graph for **generic** public https URLs after an SSRF deny list (loopback, RFC1918, `.internal`, `.local`, `.lvh.me`, nip.io). The crawler User-Agent is `BevelLinkPreview/1.0` so Magenta can keep preview hits out of visitor counts.

When OG is empty, first-party cards still unfurl: title comes from the path (`/n/demo-neuron` → “demo neuron”), description from the kind blurb. **2ndbrain +** on the card POSTs `/api/brain/clip` and ingests an organism nugget onto the 2ndbrain `clips` track.

First-party hosts skip “it is a webpage” and get a typed kicker + CTA:

| Kind | Host family | Path | Kicker | CTA |
|------|-------------|------|--------|-----|
| `preso` | `pres0.com`, `preso.lvh.me` | deck | Preso | Open deck |
| `plink` | Preso `/p/` or `/plink`, plus Magenta short hosts (`magenta.ac`, `comma.cm`) | smart link | Plink | Open link |
| `neuron` | `2ndbra.in`, `2ndbrain.lvh.me` | neuron | 2ndbrain | Open neuron |
| `olimbic` | `olimbic.games`, `olimbic.lvh.me` | profile | Olimbic | Open profile |
| `leaderboard` | Olimbic | `leaderboard`, `standings` | Leaderboard | Open standings |
| `highlight` | Olimbic | `highlight`, `/clip` | Highlight | Watch clip |

Path matching only runs **inside** those families. `github.com/p/…` stays generic.

The card (`LinkPreviewCard`) sets `data-kind`, shows the kicker, and uses the CTA as the open affordance. 2ndbrain clip stays a separate save action.
