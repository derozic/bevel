const URL_RE = /https?:\/\/[^\s<>"']+/i

export type BevelUnfurlKind =
  | 'generic'
  | 'preso'
  | 'plink'
  | 'neuron'
  | 'olimbic'
  | 'leaderboard'
  | 'highlight'

export type LinkPreview = {
  url: string
  site: string
  title: string
  description: string
  image: string | null
  kind: BevelUnfurlKind
  kicker: string
  cta: string
}

const KIND_META: Record<
  Exclude<BevelUnfurlKind, 'generic'>,
  { kicker: string; cta: string }
> = {
  preso: { kicker: 'Preso', cta: 'Open deck' },
  plink: { kicker: 'Plink', cta: 'Open link' },
  neuron: { kicker: '2ndbrain', cta: 'Open neuron' },
  olimbic: { kicker: 'Olimbic', cta: 'Open profile' },
  leaderboard: { kicker: 'Leaderboard', cta: 'Open standings' },
  highlight: { kicker: 'Highlight', cta: 'Watch clip' },
}

function hostMatches(host: string, needles: readonly string[]): boolean {
  return needles.some((needle) => host === needle || host.endsWith(`.${needle}`))
}

/** First-party host families. Path matching only happens inside these. */
function firstPartyFamily(
  host: string,
): 'preso' | 'plink' | 'neuron' | 'olimbic' | null {
  if (hostMatches(host, ['pres0.com', 'pres0.lvh.me', 'preso.lvh.me'])) {
    return 'preso'
  }
  if (hostMatches(host, ['magenta.ac', 'magenta.lvh.me', 'comma.cm'])) return 'plink'
  if (hostMatches(host, ['2ndbra.in', '2ndbrain.lvh.me'])) return 'neuron'
  if (hostMatches(host, ['olimbic.games', 'olimbic.lvh.me'])) return 'olimbic'
  return null
}

export function classifyBevelUrl(url: string): BevelUnfurlKind {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const path = u.pathname.toLowerCase()
    const family = firstPartyFamily(host)
    if (family === 'preso') {
      if (path.startsWith('/p/') || path.includes('/plink')) return 'plink'
      return 'preso'
    }
    if (family === 'plink') return 'plink'
    if (family === 'neuron') return 'neuron'
    if (family === 'olimbic') {
      if (path.includes('leaderboard') || path.includes('standings')) return 'leaderboard'
      if (path.includes('highlight') || path.includes('/clip')) return 'highlight'
      return 'olimbic'
    }
    return 'generic'
  } catch {
    return 'generic'
  }
}

export function unfurlMeta(kind: BevelUnfurlKind): { kicker: string; cta: string } {
  if (kind === 'generic') return { kicker: 'Link', cta: 'Open' }
  return KIND_META[kind]
}

function humanSegment(raw: string): string {
  try {
    return decodeURIComponent(raw)
      .replace(/^@/, '')
      .replace(/[-_]+/g, ' ')
      .trim()
  } catch {
    return raw.replace(/[-_]+/g, ' ').trim()
  }
}

/** Title from a first-party path when Open Graph is empty or just the host. */
export function titleFromBevelUrl(url: string, kind: BevelUnfurlKind): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    const parts = u.pathname.split('/').filter(Boolean)
    if (kind === 'neuron') {
      const i = parts.findIndex((p) => p === 'n' || p === 'neuron' || p === 'neurons')
      if (i >= 0 && parts[i + 1]) return humanSegment(parts[i + 1])
    }
    if (kind === 'plink' && parts[0] === 'p' && parts[1]) return humanSegment(parts[1])
    if (kind !== 'generic' && parts.length) return humanSegment(parts[parts.length - 1])
    return host
  } catch {
    return url
  }
}

export function firstPartyBlurb(kind: BevelUnfurlKind): string {
  switch (kind) {
    case 'preso':
      return 'A Preso deck'
    case 'plink':
      return 'A Preso Plink'
    case 'neuron':
      return 'A 2ndbrain neuron'
    case 'olimbic':
      return 'An Olimbic profile'
    case 'leaderboard':
      return 'Live standings'
    case 'highlight':
      return 'A game highlight'
    default:
      return ''
  }
}

function productNames(kind: BevelUnfurlKind): string[] {
  switch (kind) {
    case 'preso':
      return ['preso', 'pres0']
    case 'plink':
      return ['plink', 'magenta', 'comma', 'comma community journalism lab']
    case 'neuron':
      return ['2ndbrain', '2nd brain', 'second brain']
    case 'olimbic':
    case 'leaderboard':
    case 'highlight':
      return ['olimbic']
    default:
      return []
  }
}

/** Homepage / product-name titles are not the object. Magenta types the path first. */
export function looksLikeSiteTitle(
  title: string,
  kind: BevelUnfurlKind,
  host = '',
): boolean {
  const t = title.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!t) return true
  const hostBare = host.toLowerCase().replace(/^www\./, '')
  if (hostBare && (t === hostBare || t === hostBare.split('.')[0])) return true
  for (const name of productNames(kind)) {
    if (t === name) return true
    if (t.startsWith(name)) {
      const rest = t.slice(name.length).trim()
      if (!rest) return true
      if (/^[-—–·|:,]/.test(rest)) return true
    }
  }
  return false
}

/** Build the Magenta envelope: type the object, treat site-wide OG as empty. */
export function unfurlEnvelope(input: {
  url: string
  title: string
  description: string
  image: string | null
}): LinkPreview {
  const kind = classifyBevelUrl(input.url)
  const { kicker, cta } = unfurlMeta(kind)
  let host = ''
  try {
    host = new URL(input.url).hostname.replace(/^www\./, '')
  } catch {
    host = ''
  }
  const derived = titleFromBevelUrl(input.url, kind)
  const scraped = input.title.trim()
  const siteGeneric = kind !== 'generic' && looksLikeSiteTitle(scraped, kind, host)
  const title = (kind !== 'generic' && (siteGeneric || !scraped) ? derived : scraped).slice(0, 180)
  const description = (
    siteGeneric ? firstPartyBlurb(kind) : input.description.trim() || firstPartyBlurb(kind)
  ).slice(0, 240)
  const image = input.image && previewableUrl(input.image) ? input.image : null
  return {
    url: input.url,
    site: host,
    title,
    description,
    image,
    kind,
    kicker,
    cta,
  }
}

const BLOCKED_HOST_SUFFIXES = [
  '.local',
  '.internal',
  '.localhost',
  '.lvh.me',
  '.nip.io',
  '.sslip.io',
] as const

/** Fail-closed SSRF gate for the unfurl fetch. Loopback aliases never leave this box. */
export function previewableUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === 'lvh.me' ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return null
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null
  if (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return null
  }
  return url
}

export function firstHttpUrl(text: string): string | null {
  const match = text.match(URL_RE)
  if (!match) return null
  const raw = match[0].replace(/[),.]+$/, '')
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
