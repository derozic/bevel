import { describe, expect, it } from 'vitest'
import {
  NuggetSchema,
  parseNugget,
  serializeNugget,
  nuggetLogoPath,
  lintNugget,
  defaultNuggetPlacement,
} from './nuggets'

describe('channel nuggets', () => {
  it('round-trips an organism', () => {
    const nugget = NuggetSchema.parse({
      v: 1,
      scale: 'organism',
      source: 'clickup',
      title: 'Ship Magenta MCP card',
      summary: 'In review',
      atoms: [
        { kind: 'chip', label: 'status', value: 'in review', tone: 'accent' },
        { kind: 'person', label: 'assignee', value: 'Scott' },
      ],
    })
    const raw = serializeNugget(nugget)
    expect(raw.startsWith('bevel-nugget:v1')).toBe(true)
    expect(parseNugget(raw)?.title).toBe('Ship Magenta MCP card')
  })

  it('rejects ordinary chat text', () => {
    expect(parseNugget('hello from Hermes')).toBeNull()
  })

  it('maps sources to local SVG marks', () => {
    expect(nuggetLogoPath('Linear')).toBe('/integrations/linear.svg')
    expect(nuggetLogoPath('cmyk')).toBe('/integrations/cmyk.svg')
  })

  it('places template in the pane and page full-bleed', () => {
    expect(defaultNuggetPlacement('atom')).toBe('thread')
    expect(defaultNuggetPlacement('organism')).toBe('thread')
    expect(defaultNuggetPlacement('template')).toBe('pane')
    expect(defaultNuggetPlacement('page')).toBe('page')
  })

  it('lints atoms vs molecules vs pages', () => {
    const atom = NuggetSchema.parse({
      v: 1,
      scale: 'atom',
      source: 'magenta',
      title: 'up',
      atoms: [{ kind: 'chip', value: 'up' }],
    })
    expect(lintNugget(atom)).toEqual([])

    const fatAtom = NuggetSchema.parse({
      v: 1,
      scale: 'atom',
      source: 'magenta',
      title: 'too much',
      atoms: [
        { kind: 'chip', value: 'a' },
        { kind: 'chip', value: 'b' },
        { kind: 'chip', value: 'c' },
      ],
    })
    expect(lintNugget(fatAtom).some((i) => i.code === 'atom.too-big')).toBe(true)

    const page = NuggetSchema.parse({
      v: 1,
      scale: 'page',
      source: 'cmyk',
      title: 'BrandKit page',
      atoms: [],
    })
    expect(lintNugget(page).some((i) => i.code === 'page.empty')).toBe(true)
  })

  it('parses ingest bodies the API serializes onto a track', () => {
    const raw = `bevel-nugget:v1
${JSON.stringify({
  v: 1,
  scale: 'template',
  source: 'cmyk',
  title: 'BrandKit partial',
  sections: [{ title: 'Header', body: 'mark' }],
})}`
    const parsed = parseNugget(raw)
    expect(parsed?.scale).toBe('template')
    expect(parsed?.sections?.[0]?.title).toBe('Header')
  })

  it('lets an organism link to a related molecule', () => {
    const nugget = NuggetSchema.parse({
      v: 1,
      scale: 'organism',
      source: 'cmyk',
      title: '2x4m BrandKit shared',
      atoms: [{ kind: 'chip', value: 'tokens' }],
      related: [
        {
          v: 1,
          scale: 'molecule',
          source: 'cmyk',
          title: 'Token row',
          atoms: [
            { kind: 'chip', label: 'cyan', value: '#0ea5e9' },
            { kind: 'chip', label: 'magenta', value: '#d946ef' },
          ],
        },
      ],
    })
    expect(nugget.related?.[0]?.scale).toBe('molecule')
    expect(lintNugget(nugget)).toEqual([])
  })
})
