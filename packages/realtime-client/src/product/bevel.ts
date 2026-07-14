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
 * Channel / tag sigil in the product surface.
 * BEVEL uses `^` so channels read as workspace tags.
 */
export const CHANNEL_TAG_PREFIX = '^' as const

/** Format a channel slug for display: `^general` */
export function channelTag(slug: string): string {
  const cleaned = slug.trim().replace(/^[#^]+/, '')
  return `${CHANNEL_TAG_PREFIX}${cleaned}`
}

export const BEVEL_PRODUCT = {
  word: BEVEL_WORD,
  name: BEVEL_NAME,
  tm: BEVEL_TM,
  poweredByLabel: BEVEL_POWERED_BY_LABEL,
  trademarkNotice: BEVEL_TRADEMARK_NOTICE,
  tagline: 'Open channels for humans and agents.',
  short: 'Post once. @mention to focus.',
} as const

export type BevelProduct = typeof BEVEL_PRODUCT
