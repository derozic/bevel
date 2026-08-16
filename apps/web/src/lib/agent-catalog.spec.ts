import { describe, expect, it } from 'vitest'
import {
  agents,
  fleetRegistryMeta,
  getAgentById,
  getAvailableAgents,
} from './agent-catalog'

const EXPECTED_DIRECTORS = [
  'sterling',
  'mildred',
  'cadence',
  'tegan',
  'spark',
  'helm',
  'sable',
  'argus',
  'atlas',
  'portia',
  'haven',
  'veda',
  'rune',
  'grover',
  'flux',
] as const

describe('agent catalog (synced from ~/dev/agents)', () => {
  it('loads the current Entity org from the registry', () => {
    expect(fleetRegistryMeta.version).toBe('2.0.0')
    expect(getAvailableAgents().length).toBe(23)
    expect(agents[0]?.id).toBe('hermes')
  })

  it('resolves Hermes and every director by id', () => {
    const hermes = getAgentById('Hermes')
    expect(hermes?.id).toBe('hermes')
    expect(hermes?.avatarUrl).toBe('/avatars/hermes.svg')
    expect(hermes?.role.toLowerCase()).toContain('co-founder')

    for (const id of EXPECTED_DIRECTORS) {
      const agent = getAgentById(id)
      expect(agent?.id).toBe(id)
      expect(agent?.avatarUrl).toBe(`/avatars/${id}.svg`)
      expect(agent?.bio.length).toBeGreaterThan(0)
    }
  })

  it('keeps legacy ICs addressable so existing talk URLs still work', () => {
    for (const id of ['johnny', 'brain', 'loom', 'northstar', 'lego', 'continuous']) {
      expect(getAgentById(id)?.id).toBe(id)
    }
    expect(getAgentById('not-an-agent')).toBeUndefined()
  })
})
