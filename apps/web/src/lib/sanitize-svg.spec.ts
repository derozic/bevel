import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from './sanitize-svg'

describe('sanitizeSvg', () => {
  it('keeps a simple path mark', () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1h8v8H1z" fill="#111"/></svg>',
    )
    expect(out).toContain('<path')
    expect(out).toContain('viewbox="0 0 10 10"')
  })

  it('keeps fragment use hrefs and drops external ones', () => {
    const kept = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><path id="p" d="M0 0h1v1H0z"/></defs><use href="#p"/></svg>',
    )
    expect(kept).toContain('href="#p"')
    const stripped = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="/secret.svg"/></svg>',
    )
    expect(stripped).toContain('<use')
    expect(stripped).not.toContain('href=')
  })

  it('rejects script and event handlers', () => {
    expect(
      sanitizeSvg(
        '<svg><script>alert(1)</script><path d="M0 0h1v1H0z"/></svg>',
      ),
    ).toBeNull()
    expect(
      sanitizeSvg(
        '<svg><path d="M0 0h1v1H0z" onload="alert(1)"/></svg>',
      ),
    ).toBeNull()
  })

  it('rejects javascript hrefs, data URLs, and foreignObject', () => {
    expect(
      sanitizeSvg(
        '<svg><a href="javascript:alert(1)"><path d="M0 0h1v1H0z"/></a></svg>',
      ),
    ).toBeNull()
    expect(
      sanitizeSvg(
        '<svg><use href="data:image/svg+xml,<svg>"/></svg>',
      ),
    ).toBeNull()
    expect(
      sanitizeSvg(
        '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body></foreignObject></svg>',
      ),
    ).toBeNull()
  })

  it('drops unknown tags instead of inlining them', () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="https://evil.example"></iframe><circle cx="1" cy="1" r="1"/></svg>',
    )
    expect(out).toContain('<circle')
    expect(out).not.toContain('iframe')
    expect(out).not.toContain('evil.example')
  })

  it('rejects oversized payloads', () => {
    const huge = `<svg>${'a'.repeat(513 * 1024)}</svg>`
    expect(sanitizeSvg(huge)).toBeNull()
  })
})
