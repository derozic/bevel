import type { Tenant } from '@bevel/schema'

export const DEFAULT_CMYK_HOST = 'https://cmyk.2x4m.lvh.me'
export const DEFAULT_CMYK_PROCESS = {
  cyan: '#0ea5e9',
  magenta: '#d946ef',
  yellow: '#eab308',
  key: '#111827',
} as const

export type CmykProcess = {
  cyan: string
  magenta: string
  yellow: string
  key: string
}

export type CmykBrandKitTheme = {
  id?: number | string
  name?: string
  is_active?: boolean
  tokens?: Record<string, string | undefined>
  typography?: { families?: Record<string, string | undefined> }
  cmyk?: Partial<CmykProcess>
  logos?: { primary?: string; dark?: string; favicon?: string; icon?: string }
  theme_color?: string
  brand_icon_url?: string
  favicon_url?: string
  css_variables?: Record<string, string>
}

const cache = new Map<string, { at: number; theme: CmykBrandKitTheme | null }>()
const CACHE_MS = 5 * 60 * 1000

export function cmykBrandKitHost(override?: string | null): string {
  const raw =
    override?.trim() ||
    process.env.CMYK_BRANDKIT_URL ||
    process.env.NEXT_PUBLIC_CMYK_BRANDKIT_URL ||
    DEFAULT_CMYK_HOST
  return raw.replace(/\/$/, '')
}

export function resolveCmykKitId(tenant: Tenant | null | undefined): string | null {
  const explicit = tenant?.theme.cmykKitId
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    return String(explicit).trim()
  }
  return tenant?.slug ?? null
}

export function stripCssUrl(value: string | undefined | null): string {
  if (!value) return ''
  return value.trim().replace(/^"+|"+$/g, '').replace(/^url\((['"]?)(.*)\1\)$/i, '$2')
}

function hexish(value: string | undefined, fallback: string): string {
  const v = (value || '').trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  return fallback
}

export function processFromKit(theme: CmykBrandKitTheme | null | undefined): CmykProcess {
  return {
    cyan: hexish(theme?.cmyk?.cyan, DEFAULT_CMYK_PROCESS.cyan),
    magenta: hexish(theme?.cmyk?.magenta, DEFAULT_CMYK_PROCESS.magenta),
    yellow: hexish(theme?.cmyk?.yellow, DEFAULT_CMYK_PROCESS.yellow),
    key: hexish(theme?.cmyk?.key, DEFAULT_CMYK_PROCESS.key),
  }
}

/** Stable process-color pick so each square reads as part of the kit, not random. */
export function processColorForKey(
  key: string,
  process: CmykProcess = DEFAULT_CMYK_PROCESS,
): string {
  const order = [process.cyan, process.magenta, process.yellow, process.key] as const
  let hash = 0
  const s = key.trim().toLowerCase()
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 33 + s.charCodeAt(i)) >>> 0
  }
  return order[hash % order.length] ?? process.cyan
}

export function brandMarkFromKit(
  theme: CmykBrandKitTheme | null | undefined,
): string {
  return (
    stripCssUrl(theme?.logos?.icon) ||
    stripCssUrl(theme?.brand_icon_url) ||
    stripCssUrl(theme?.css_variables?.['--brand-icon-url']) ||
    stripCssUrl(theme?.logos?.primary) ||
    stripCssUrl(theme?.css_variables?.['--logo-url']) ||
    ''
  )
}

export function mergeBrandKitIntoTheme(
  tenant: Tenant,
  theme: CmykBrandKitTheme,
): Tenant {
  const tokens = theme.tokens ?? {}
  const accent =
    hexish(tokens.accent, '') ||
    hexish(tokens.primary, '') ||
    hexish(theme.theme_color, tenant.theme.accent)
  const background = hexish(tokens.background, tenant.theme.background ?? '')
  const text = hexish(tokens.foreground, tenant.theme.text ?? '')
  const mark = brandMarkFromKit(theme)
  return {
    ...tenant,
    theme: {
      ...tenant.theme,
      accent,
      background: background || tenant.theme.background,
      text: text || tenant.theme.text,
      fontSans:
        theme.typography?.families?.body ||
        theme.typography?.families?.primary ||
        tenant.theme.fontSans,
      brandIconUrl: mark || tenant.theme.brandIconUrl,
      logoUrl: mark || tenant.theme.logoUrl,
      markUrl: mark || tenant.theme.markUrl,
    },
  }
}

export async function fetchCmykBrandKitTheme(opts: {
  kitId: string | number
  host?: string | null
  timeoutMs?: number
}): Promise<CmykBrandKitTheme | null> {
  const host = cmykBrandKitHost(opts.host)
  const id = encodeURIComponent(String(opts.kitId))
  const cacheKey = `${host}::${id}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.theme

  const url = `${host}/brandkits/api/brand-kits/${id}/theme/`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 2500)
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const key = process.env.CMYK_BRANDKIT_API_KEY?.trim()
    if (key) headers['X-API-Key'] = key
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers,
    })
    if (!res.ok) {
      cache.set(cacheKey, { at: Date.now(), theme: null })
      return null
    }
    const data = (await res.json()) as CmykBrandKitTheme
    cache.set(cacheKey, { at: Date.now(), theme: data })
    return data
  } catch {
    cache.set(cacheKey, { at: Date.now(), theme: null })
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function resolveTenantWithBrandKit(
  tenant: Tenant | null,
): Promise<Tenant | null> {
  if (!tenant) return null
  const kitId = resolveCmykKitId(tenant)
  if (!kitId) return tenant
  const theme = await fetchCmykBrandKitTheme({
    kitId,
    host: tenant.theme.cmykHost,
  })
  if (!theme) return tenant
  return mergeBrandKitIntoTheme(tenant, theme)
}
