/**
 * Local picker tiles must never follow production handoff URLs.
 * Stale RSC HTML still points at bevel.2x4m.cc / bevel.decli.dev; those
 * fail and dump the browser on localhost:41009.
 */

const PRODUCTION_TO_PREVIEW: Record<string, string> = {
  'bevel.2x4m.cc': 'bevel.2x4m.lvh.me',
  'bevel.decli.dev': 'bevel.decli.lvh.me',
  'bevel.olimbic.games': 'bevel.olimbic.lvh.me',
  'bevel.2ndbra.in': 'bevel.2ndbrain.lvh.me',
  'bevel.pres0.com': 'bevel.preso.lvh.me',
  'bevel.preso.lvh.me': 'bevel.preso.lvh.me',
  'demo.2x4m.cc': 'demo.2x4m.lvh.me',
}

function isLocalPageHost(hostname: string): boolean {
  const h = hostname.toLowerCase().split(':')[0] || ''
  return (
    h === 'lvh.me' ||
    h.endsWith('.lvh.me') ||
    h === 'localhost' ||
    h === '127.0.0.1'
  )
}

function previewFor(hostname: string): string | null {
  const h = hostname.toLowerCase().split(':')[0] || ''
  if (PRODUCTION_TO_PREVIEW[h]) return PRODUCTION_TO_PREVIEW[h]
  if (h.endsWith('.lvh.me')) return h
  return null
}

export function rewriteLocalWorkspaceHref(
  href: string,
  pageHost = typeof window !== 'undefined' ? window.location.hostname : '',
): string {
  if (!href || !isLocalPageHost(pageHost)) return href
  let url: URL
  try {
    url = new URL(href, `https://${pageHost}`)
  } catch {
    return href
  }

  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') {
    const dest = previewFor(pageHost) || pageHost
    return `https://${dest}/~general`
  }

  const preview = previewFor(host)
  if (!preview) return href

  if (url.pathname.startsWith('/api/auth/handoff')) {
    const callback = url.searchParams.get('callbackUrl') || '/~general'
    const path = callback.startsWith('/') ? callback : '/~general'
    return `https://${preview}${path}`
  }

  if (preview === host) return href
  url.hostname = preview
  url.port = ''
  url.protocol = 'https:'
  return url.toString()
}
