import type { DaypartId, DaypartLogoUrls } from '@bevel/schema'

export const DAYPART_LOGO_SLOTS: DaypartId[] = [
  'morning',
  'midday',
  'afternoon',
  'night',
]

/** Synthetic / file-less slugs — never invent a /brand/{slug}/logo.svg URL. */
const SLUGS_WITHOUT_BRAND_FILE = new Set(['platform', 'default', 'apex'])

/**
 * Pick the workspace mark for the active day part.
 * Falls back: daypart slot → explicit logoUrl → known on-disk /brand/{slug}/logo.svg.
 * Do not invent a path for platform/private — a 404 + img remount loops the rail.
 */
export function resolveWorkspaceLogoUrl(opts: {
  daypart?: DaypartId | string | null
  logoUrl?: string | null
  logoUrlsByDaypart?: DaypartLogoUrls | null
  tenantSlug?: string | null
}): string | undefined {
  const part = opts.daypart as DaypartId | undefined
  if (part && opts.logoUrlsByDaypart?.[part]) {
    return opts.logoUrlsByDaypart[part]
  }
  const explicit = opts.logoUrl?.trim()
  if (explicit) return explicit
  const slug = (opts.tenantSlug || '').trim().toLowerCase()
  if (!slug || SLUGS_WITHOUT_BRAND_FILE.has(slug)) return undefined
  return `/brand/${slug}/logo.svg`
}

/** Public path convention for a daypart logo upload. */
export function daypartLogoPublicPath(
  slug: string,
  daypart: DaypartId,
  ext: string,
): string {
  return `/brand/${slug}/logo-${daypart}.${ext.replace(/^\./, '')}`
}
