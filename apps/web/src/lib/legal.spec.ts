import { describe, expect, it } from 'vitest'
import {
  LEGAL_NAV,
  LEGAL_OPERATOR,
  LEGAL_PATHS,
  LEGAL_PRODUCT,
  LEGAL_UPDATED,
} from './legal'
import { PUBLIC_MARKETING_PATHS } from './marketing'

describe('legal pages', () => {
  it('names Earthena as operator and dates the drafts', () => {
    expect(LEGAL_OPERATOR).toMatch(/Earthena/)
    expect(LEGAL_PRODUCT).toBe('BEVEL')
    expect(LEGAL_UPDATED).toMatch(/2026/)
  })

  it('is on the public marketing surface', () => {
    for (const path of LEGAL_PATHS) {
      expect(PUBLIC_MARKETING_PATHS).toContain(path)
    }
  })

  it('lists every legal path in the article nav', () => {
    expect(LEGAL_NAV.map((item) => item.href)).toEqual([...LEGAL_PATHS])
  })
})
