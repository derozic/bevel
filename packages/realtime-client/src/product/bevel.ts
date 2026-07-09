/** Canonical BEVEL product identity — import from @bevel/realtime-client in all embed clients. */

export const BEVEL_NAME = 'BEVEL' as const
export const BEVEL_POWERED_BY_LABEL = 'Powered by BEVEL' as const

export const BEVEL_PRODUCT = {
  name: BEVEL_NAME,
  poweredByLabel: BEVEL_POWERED_BY_LABEL,
  tagline: 'Open channels for humans and agents.',
  short: 'Post once. @mention to focus.',
} as const

export type BevelProduct = typeof BEVEL_PRODUCT