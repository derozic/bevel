/** Canonical BEVEL product identity — import from @bevel/realtime-client in all embed clients. */

/** Word mark without the ™ sigil (IDs, monograms, code). */
export const BEVEL_WORD = 'BEVEL' as const

/** Common-law trademark sigil — rights claimed by use (not ® registration). */
export const BEVEL_TM = '™' as const

/** Display name throughout the product: BEVEL™ */
export const BEVEL_NAME = `${BEVEL_WORD}${BEVEL_TM}` as const

export const BEVEL_POWERED_BY_LABEL = `Powered by ${BEVEL_NAME}` as const

/** Footer / legal line — ™ by use, not registered mark. */
export const BEVEL_TRADEMARK_NOTICE = `${BEVEL_NAME} · Trademark by use` as const

/**
 * Channel / tag sigil in the product surface and public URLs.
 * Uses `~` (RFC unreserved) so paths never encode: https://host/~general
 *
 * Display can show `^slug` when the channel is **escalated** (high priority)
 * in the user's rail — that is a UI priority marker, not a different URL.
 * Public paths stay `/~slug` either way.
 */
export const CHANNEL_TAG_PREFIX = '~' as const
/** Display-only prefix for high-priority / escalated channels in the rail. */
export const CHANNEL_ESCALATED_PREFIX = '^' as const

/** Format a channel slug for display: `~general` or `^general` if escalated. */
export function channelTag(
  slug: string,
  options?: { escalated?: boolean },
): string {
  const cleaned = slug.trim().replace(/^[#^~]+/, '')
  const prefix = options?.escalated
    ? CHANNEL_ESCALATED_PREFIX
    : CHANNEL_TAG_PREFIX
  return `${prefix}${cleaned}`
}

/** True when a display tag or raw input uses the escalated caret form. */
export function isEscalatedChannelTag(raw: string): boolean {
  return /^\^/.test(raw.trim()) || /^%5e/i.test(raw.trim())
}

export const BEVEL_PRODUCT = {
  word: BEVEL_WORD,
  name: BEVEL_NAME,
  tm: BEVEL_TM,
  poweredByLabel: BEVEL_POWERED_BY_LABEL,
  trademarkNotice: BEVEL_TRADEMARK_NOTICE,
  tagline: 'Open tracks for humans and agents.',
  short: 'Post once. @mention to focus.',
} as const

export type BevelProduct = typeof BEVEL_PRODUCT
