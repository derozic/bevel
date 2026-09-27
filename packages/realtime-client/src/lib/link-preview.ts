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
