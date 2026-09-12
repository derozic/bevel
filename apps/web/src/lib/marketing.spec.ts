import { describe, expect, it } from 'vitest'
import {
  BEVEL_CONTACT_EMAIL,
  FOOTER_COLUMNS,
  MARKETING_NAV,
  PUBLIC_MARKETING_PATHS,
} from './marketing'
import { BEVEL_HOME_PATH } from './bevel'
import { ONBOARDING_HREFS, shouldShowFirstRun } from './onboarding'

describe('marketing structure', () => {
  it('exposes a complete signed-out public surface', () => {
    expect(PUBLIC_MARKETING_PATHS).toEqual(
      expect.arrayContaining([
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
      ]),
    )
  })

  it('keeps nav and footer on real routes (no dangling hashes-only product)', () => {
    const hrefs = [
      ...MARKETING_NAV.map((item) => item.href),
      ...FOOTER_COLUMNS.flatMap((col) => col.links.map((link) => link.href)),
    ]
    expect(hrefs).toContain('/story')
    expect(hrefs).toContain('/about')
    expect(hrefs).toContain('/download')
    expect(hrefs).toContain('/claim')
    expect(hrefs).toContain('/status')
    expect(hrefs.some((h) => h.startsWith('mailto:hello@bevel.is'))).toBe(true)
  })

  it('uses the product domain for contact', () => {
    expect(BEVEL_CONTACT_EMAIL).toBe('hello@bevel.is')
  })
})

describe('onboarding destinations', () => {
  it('never concatenates /general onto the channel home', () => {
    expect(ONBOARDING_HREFS.channel).toBe(BEVEL_HOME_PATH)
    expect(ONBOARDING_HREFS.channel).toBe('/~general')
    expect(ONBOARDING_HREFS.privateHome).toBe('/me')
    expect(ONBOARDING_HREFS.hermes).toBe('/talk/hermes')
    for (const href of Object.values(ONBOARDING_HREFS)) {
      expect(href).not.toContain('/~general/general')
    }
  })

  it('hides first-run after the matching step is done', () => {
    expect(shouldShowFirstRun({}, 'private')).toBe(true)
    expect(shouldShowFirstRun({ hermes: true }, 'private')).toBe(false)
    expect(shouldShowFirstRun({ dismissed: true }, 'org')).toBe(false)
    expect(shouldShowFirstRun({ channel: true }, 'org')).toBe(false)
    expect(shouldShowFirstRun({}, 'org')).toBe(true)
  })
})
