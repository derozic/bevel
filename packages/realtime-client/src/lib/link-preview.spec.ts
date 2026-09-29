import { describe, expect, it } from 'vitest'
import {
  classifyBevelUrl,
  firstHttpUrl,
  firstPartyBlurb,
  looksLikeSiteTitle,
  previewableUrl,
  siteLabel,
  titleFromBevelUrl,
  unfurlEnvelope,
  unfurlMeta,
} from './link-preview'

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

  it('titles first-party URLs from the path when OG is missing', () => {
    expect(titleFromBevelUrl('https://2ndbra.in/n/demo-neuron', 'neuron')).toBe('demo neuron')
    expect(titleFromBevelUrl('https://bevel.pres0.com/p/book-a-call', 'plink')).toBe(
      'book a call',
    )
    expect(titleFromBevelUrl('https://olimbic.games/@scott', 'olimbic')).toBe('scott')
    expect(firstPartyBlurb('highlight')).toBe('A game highlight')
  })

  it('refuses loopback and lvh.me so the crawler cannot SSRF', () => {
    expect(previewableUrl('https://example.com/a')?.hostname).toBe('example.com')
    expect(previewableUrl('https://127.0.0.1/secret')).toBeNull()
    expect(previewableUrl('https://bevel.2ndbrain.lvh.me/n/x')).toBeNull()
    expect(previewableUrl('http://10.0.0.4/admin')).toBeNull()
  })

  it('treats homepage product titles as empty Open Graph', () => {
    expect(
      looksLikeSiteTitle('2nd Brain - Your AI-Powered Second Brain', 'neuron', '2ndbra.in'),
    ).toBe(true)
    expect(looksLikeSiteTitle('OLIMBIC · Weekly body contests', 'olimbic', 'olimbic.games')).toBe(
      true,
    )
    expect(looksLikeSiteTitle('Magenta — First-party analytics you own', 'plink', 'magenta.ac')).toBe(
      true,
    )
    expect(looksLikeSiteTitle('Raise round', 'preso', 'pres0.com')).toBe(false)
    expect(looksLikeSiteTitle('demo neuron | 2ndBrain', 'neuron', '2ndbra.in')).toBe(false)
  })

  it('uses the path title when first-party OG is site-wide marketing copy', () => {
    const neuron = unfurlEnvelope({
      url: 'https://2ndbra.in/n/demo-neuron',
      title: '2nd Brain - Your AI-Powered Second Brain',
      description:
        'Transform your digital knowledge into an intelligent companion. Save everything, recall anything.',
      image: null,
    })
    expect(neuron).toMatchObject({
      kind: 'neuron',
      kicker: '2ndbrain',
      cta: 'Open neuron',
      title: 'demo neuron',
      description: 'A 2ndbrain neuron',
    })

    const preso = unfurlEnvelope({
      url: 'https://bevel.pres0.com/decks/raise',
      title: 'Q3 fundraising',
      description: 'Twelve slides on the round',
      image: null,
    })
    expect(preso.title).toBe('Q3 fundraising')
    expect(preso.description).toBe('Twelve slides on the round')
  })
})
