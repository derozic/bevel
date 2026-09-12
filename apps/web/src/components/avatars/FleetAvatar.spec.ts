import { describe, expect, it } from 'vitest'
import { agents } from '@/lib/agent-catalog'
import { AGENT_GLYPH_IDS, AGENT_GLYPHS } from './glyphs'
import { isDarkAgentPlate } from './FleetAvatar'

describe('fleet sticker glyphs', () => {
  it('ships a unique SVG motif for every catalog agent', () => {
    const missing = agents
      .map((a) => a.id)
      .filter((id) => !AGENT_GLYPHS[id])
    expect(missing).toEqual([])
    expect(AGENT_GLYPH_IDS.length).toBeGreaterThanOrEqual(agents.length)
  })

  it('uses CSS variables so day-part can restyle contrast', () => {
    for (const id of ['hermes', 'openai', 'cadence', 'sterling']) {
      expect(AGENT_GLYPHS[id]).toContain('--agent-plate')
      expect(AGENT_GLYPHS[id]).not.toContain('<text')
    }
  })

  it('treats near-black plates as dark (night invert)', () => {
    expect(isDarkAgentPlate('#101010')).toBe(true)
    expect(isDarkAgentPlate('#111111')).toBe(true)
    expect(isDarkAgentPlate('#1a1410')).toBe(true)
    expect(isDarkAgentPlate('#0d9488')).toBe(false)
    expect(isDarkAgentPlate('#d4af37')).toBe(false)
  })
})
