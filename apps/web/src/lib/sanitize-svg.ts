/**
 * Fail-closed SVG lint for chat uploads.
 * Never inline the result as HTML — serve via <img src>.
 */

const MAX_SVG_BYTES = 512 * 1024

const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'clippath',
  'mask',
  'lineargradient',
  'radialgradient',
  'stop',
  'title',
  'desc',
  'symbol',
  'use',
  'marker',
  'pattern',
])

const ALLOWED_ATTR = new Set([
  'id',
  'class',
  'viewbox',
  'xmlns',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'fill-rule',
  'clip-rule',
  'transform',
  'gradientunits',
  'gradienttransform',
  'offset',
  'stop-color',
  'stop-opacity',
  'spreadmethod',
  'xlink:href',
  'xmlns:xlink',
  'href',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'preserveaspectratio',
  'overflow',
  'font-size',
  'font-family',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
])

function isSafeHref(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (v.startsWith('#')) return true
  const lower = v.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return false
  return false
}

function isSafeAttrValue(name: string, value: string): boolean {
  const lower = value.toLowerCase()
  if (lower.includes('javascript:') || lower.includes('data:text/html')) return false
  if (name === 'href' || name === 'xlink:href') return isSafeHref(value)
  if (name === 'style') return false
  return true
}

export function sanitizeSvg(raw: string): string | null {
  if (typeof raw !== 'string') return null
  if (Buffer.byteLength(raw, 'utf8') > MAX_SVG_BYTES) return null
  let src = raw.replace(/^\uFEFF/, '').trim()
  if (!src) return null
  src = src.replace(/<\?xml[\s\S]*?\?>/gi, '')
  src = src.replace(/<!DOCTYPE[\s\S]*?>/gi, '')
  src = src.replace(/<!--[\s\S]*?-->/g, '')
  src = src.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '')
  if (/<script[\s>]/i.test(src) || /on[a-z]+\s*=/i.test(src)) return null
  if (/<foreignobject/i.test(src)) return null
  if (/javascript:/i.test(src) || /\bdata:/i.test(src)) return null

  const open = src.match(/<svg\b[^>]*>/i)
  const close = src.toLowerCase().lastIndexOf('</svg>')
  if (!open || close === -1) return null

  const rebuilt: string[] = []
  const tagRe = /<\/?([a-zA-Z][\w:-]*)\b([^>]*)\/?>/g
  let match: RegExpExecArray | null
  let last = 0
  let sawSvg = false
  while ((match = tagRe.exec(src))) {
    const text = src.slice(last, match.index)
    if (text && sawSvg) rebuilt.push(text.replace(/[<>]/g, ''))
    last = match.index + match[0].length
    const name = match[1].toLowerCase()
    const closing = match[0].startsWith('</')
    const selfClose = /\/>$/.test(match[0])
    if (!ALLOWED_TAGS.has(name)) continue
    if (name === 'svg') sawSvg = true
    if (closing) {
      rebuilt.push(`</${name}>`)
      continue
    }
    const attrs: string[] = []
    const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
    const rawAttrs = match[2] || ''
    let am: RegExpExecArray | null
    while ((am = attrRe.exec(rawAttrs))) {
      const attrName = am[1].toLowerCase()
      const attrVal = am[2] ?? am[3] ?? am[4] ?? ''
      if (!ALLOWED_ATTR.has(attrName)) continue
      if (attrName.startsWith('on')) continue
      if (!isSafeAttrValue(attrName, attrVal)) continue
      attrs.push(`${attrName}="${attrVal.replace(/"/g, '&quot;')}"`)
    }
    if (name === 'svg' && !attrs.some((a) => a.startsWith('xmlns='))) {
      attrs.unshift('xmlns="http://www.w3.org/2000/svg"')
    }
    rebuilt.push(`<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}${selfClose ? ' /' : ''}>`)
  }
  const out = rebuilt.join('').trim()
  if (!/^<svg\b/i.test(out) || !/<\/svg>\s*$/i.test(out)) return null
  return out
}

export const SVG_MAX_BYTES = MAX_SVG_BYTES
