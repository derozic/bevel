import type { DaypartId, DaypartLogoUrls } from '@bevel/schema'

export const DAYPART_LOGO_SLOTS: DaypartId[] = [
  'morning',
  'midday',
  'afternoon',
  'night',
]

/**
 * Pick the workspace mark for the active day part.
 * Falls back: daypart slot → default logoUrl → generic /brand path.
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
  if (opts.logoUrl) return opts.logoUrl
  if (opts.tenantSlug) return `/brand/${opts.tenantSlug}/logo.svg`
  return undefined
}

/** Public path convention for a daypart logo upload. */
export function daypartLogoPublicPath(
  slug: string,
  daypart: DaypartId,
  ext: string,
): string {
  return `/brand/${slug}/logo-${daypart}.${ext.replace(/^\./, '')}`
}
