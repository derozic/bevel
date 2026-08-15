import { describe, expect, it } from 'vitest'
import {
  folkEntityHref,
  folkTagPath,
  normalizeFolkTag,
  parseFolkTags,
} from './folksonomy'

describe('folksonomy', () => {
  it('normalizes freeform tags into slugs', () => {
    expect(normalizeFolkTag('TypeScript')).toBe('typescript')
    expect(normalizeFolkTag(' on call ')).toBe('on-call')
    expect(normalizeFolkTag('###')).toBe('')
  })

  it('parses and dedupes a mixed bag of tags', () => {
    expect(parseFolkTags('AI, product, ai, On-Call')).toEqual([
      'ai',
      'product',
      'on-call',
    ])
  })

  it('routes a tag and each entity kind to a standing URL', () => {
    expect(folkTagPath('On Call')).toBe('/tags/on-call')
    expect(folkEntityHref('agent', 'hermes')).toBe('/talk/hermes')
    expect(folkEntityHref('track', 'general')).toBe('/~general')
    expect(folkEntityHref('person', '@scott')).toBe('/u/scott')
  })
})
