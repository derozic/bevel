/** Shared marketing / launch content for BEVEL platform surfaces. */

export const BEVEL_CONTACT_EMAIL = 'hello@bevel.is'

export const BEVEL_SOCIAL = {
  x: 'https://x.com/bevel',
  github: 'https://github.com/derozic',
  linkedin: 'https://www.linkedin.com/company/bevel',
  youtube: 'https://www.youtube.com/@bevel',
} as const

export const MARKETING_NAV = [
  { href: '/#value', label: 'Product' },
  { href: '/#how', label: 'How it works' },
  { href: '/story', label: 'Story' },
  { href: '/about', label: 'About' },
  { href: '/download', label: 'Download' },
] as const

/** Signed-out public pages that must 200 on the platform entry host. */
export const PUBLIC_MARKETING_PATHS = [
  '/',
  '/story',
  '/about',
  '/security',
  '/privacy',
  '/terms',
  '/claim',
  '/download',
  '/login',
  '/status',
] as const

export const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#value', label: 'Why BEVEL' },
      { href: '/#how', label: 'How it works' },
      { href: '/#platform', label: 'Platform' },
      { href: '/claim', label: 'Claim workspace' },
      { href: '/download', label: 'Download' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/story', label: 'Story' },
      { href: '/security', label: 'Security' },
      { href: '/status', label: 'Status' },
      { href: `mailto:${BEVEL_CONTACT_EMAIL}`, label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/security', label: 'Security' },
    ],
  },
] as const
