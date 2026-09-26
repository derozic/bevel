/** Public legal copy constants. Counsel should review before production filings. */

export const LEGAL_OPERATOR = 'Earthena, Inc.'
export const LEGAL_PRODUCT = 'BEVEL'
export const LEGAL_UPDATED = 'September 26, 2026'
export const LEGAL_JURISDICTION = 'the State of California'
export const LEGAL_ADDRESS = 'United States'

export const LEGAL_PATHS = [
  '/terms',
  '/privacy',
  '/gdpr',
  '/ccpa',
  '/cookies',
  '/dpa',
  '/security',
] as const

export const LEGAL_NAV: ReadonlyArray<{ href: (typeof LEGAL_PATHS)[number]; label: string }> = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/gdpr', label: 'GDPR' },
  { href: '/ccpa', label: 'CCPA' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/dpa', label: 'DPA' },
  { href: '/security', label: 'Security' },
]
