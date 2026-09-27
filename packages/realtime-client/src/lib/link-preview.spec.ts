import { describe, expect, it } from 'vitest'
import { classifyBevelUrl, firstHttpUrl, siteLabel, unfurlMeta } from './link-preview'

describe('link preview', () => {
  it('strips trailing punctuation from the first http url', () => {
    expect(firstHttpUrl('see https://bevel.is/join/abc.')).toBe(
      'https://bevel.is/join/abc',
    )
    expect(firstHttpUrl('no link here')).toBeNull()
  })

  it('labels a site without www', () => {
    expect(siteLabel('https://www.example.com/a')).toBe('example.com')
  })

  it('classifies first-party hosts and ignores lookalike paths on other sites', () => {
    expect(classifyBevelUrl('https://bevel.pres0.com/decks/raise')).toBe('preso')
    expect(classifyBevelUrl('https://bevel.preso.lvh.me/p/book-a-call')).toBe('plink')
    expect(classifyBevelUrl('https://comma.cm/4kh31h')).toBe('plink')
    expect(classifyBevelUrl('https://2ndbra.in/n/demo-neuron')).toBe('neuron')
    expect(classifyBevelUrl('https://bevel.olimbic.games/@scott')).toBe('olimbic')
    expect(classifyBevelUrl('https://olimbic.games/leaderboard')).toBe('leaderboard')
    expect(classifyBevelUrl('https://olimbic.games/clip/finals')).toBe('highlight')
    expect(classifyBevelUrl('https://github.com/p/whatever')).toBe('generic')
    expect(classifyBevelUrl('https://news.example/leaderboard')).toBe('generic')
  })

  it('returns Magenta-style kicker and cta for each kind', () => {
    expect(unfurlMeta('preso')).toEqual({ kicker: 'Preso', cta: 'Open deck' })
    expect(unfurlMeta('neuron')).toEqual({ kicker: '2ndbrain', cta: 'Open neuron' })
    expect(unfurlMeta('generic')).toEqual({ kicker: 'Link', cta: 'Open' })
  })
})
