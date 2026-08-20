import { describe, expect, it } from 'vitest'
import {
  agentTalkHref,
  emptyIcFacets,
  filterIcs,
  getChildren,
  getDiamondWorkflows,
  getIcs,
  getOrgNode,
  getOrgNodes,
  icFacetOptions,
  orgDynamics,
  orgStats,
} from './org-graph'

describe('org graph', () => {
  it('keeps the named directors on the same Hermes row as Sterling and Mildred', () => {
    const peers = [
      'tegan',
      'helm',
      'sable',
      'spark',
      'argus',
      'portia',
      'haven',
      'veda',
      'rune',
      'grover',
      'flux',
    ]
    const sterling = getOrgNode('sterling')
    expect(sterling?.parentId).toBe('hermes')
    expect(sterling?.tier).toBe('director')
    for (const id of peers) {
      const node = getOrgNode(id)
      expect(node?.parentId, id).toBe('hermes')
      expect(node?.tier, id).toBe('director')
    }
    const hermesKids = getChildren('hermes').map((n) => n.id)
    expect(hermesKids).toEqual(
      expect.arrayContaining(['sterling', 'mildred', ...peers]),
    )
  })

  it('loads soul, skills, and example workflows for a director profile', () => {
    const mildred = getOrgNode('mildred')
    expect(mildred?.soul.toLowerCase()).toContain('token')
    expect(mildred?.skills.length).toBeGreaterThan(3)
    expect(mildred?.skills).toEqual(
      expect.arrayContaining(['OpenRouter Ledger', 'Bevel Charts']),
    )
    expect(mildred?.workflows).toEqual(
      expect.arrayContaining(['cost-close', 'budget-review']),
    )
    expect(mildred?.runHint.toLowerCase()).toContain('finance')
  })

  it('builds the founder → Hermes → directors tree', () => {
    const nodes = getOrgNodes()
    const founder = getOrgNode('scott')
    const hermes = getOrgNode('hermes')
    expect(founder?.tier).toBe('founder')
    expect(founder?.childIds).toContain('hermes')
    expect(hermes?.parentId).toBe('scott')
    expect(getChildren('hermes').length).toBeGreaterThanOrEqual(10)
    expect(nodes.length).toBeGreaterThan(15)
  })

  it('keeps Cadence and Argus pods as nested hierarchy', () => {
    expect(getOrgNode('lego')?.parentId).toBe('cadence')
    expect(getOrgNode('brain')?.parentId).toBe('cadence')
    expect(getOrgNode('johnny')?.parentId).toBe('argus')
    expect(getChildren('cadence').map((n) => n.id)).toEqual(
      expect.arrayContaining(['lego', 'brain', 'codegraph', 'continuous']),
    )
  })

  it('lists every IC with pod, category, and legacy facets', () => {
    const ics = getIcs()
    expect(ics.map((ic) => ic.node.id).sort()).toEqual([
      'brain',
      'codegraph',
      'continuous',
      'johnny',
      'lego',
      'loom',
      'northstar',
    ])
    expect(ics.every((ic) => ic.node.tier === 'ic')).toBe(true)
    expect(ics.find((ic) => ic.node.id === 'lego')?.manager?.id).toBe('cadence')
    expect(ics.find((ic) => ic.node.id === 'loom')?.manager?.id).toBe('spark')
    expect(ics.find((ic) => ic.node.id === 'northstar')?.manager?.id).toBe('helm')
    expect(ics.find((ic) => ic.node.id === 'johnny')?.manager?.id).toBe('argus')
    expect(ics.find((ic) => ic.node.id === 'continuous')?.legacy).toBe(true)
    expect(ics.find((ic) => ic.node.id === 'northstar')?.legacy).toBe(true)
    expect(ics.find((ic) => ic.node.id === 'lego')?.legacy).toBe(false)

    const facets = icFacetOptions(ics)
    expect(facets.pods.find((p) => p.id === 'cadence')?.count).toBe(4)
    expect(facets.pods.map((p) => p.id)).toEqual(
      expect.arrayContaining(['cadence', 'argus', 'spark', 'helm']),
    )
    expect(facets.categories.length).toBeGreaterThanOrEqual(4)
    expect(facets.kinds.find((k) => k.id === 'legacy')?.count).toBe(2)

    const cadence = filterIcs(ics, { ...emptyIcFacets, pod: 'cadence' })
    expect(cadence.map((ic) => ic.node.id).sort()).toEqual([
      'brain',
      'codegraph',
      'continuous',
      'lego',
    ])
    const active = filterIcs(ics, { ...emptyIcFacets, kind: 'active' })
    expect(active).toHaveLength(5)
    expect(active.some((ic) => ic.node.id === 'northstar')).toBe(false)
  })

  it('reports fleet size and director coverage', () => {
    const nodes = getOrgNodes()
    const stats = orgStats(nodes)
    expect(stats.fleet).toBe(nodes.filter((n) => n.tier !== 'founder').length)
    expect(stats.byTier.director).toBeGreaterThanOrEqual(13)
    expect(stats.fleet).toBe(stats.byTier.director + stats.byTier.ic + stats.byTier['co-founder'])
    const dyn = orgDynamics(nodes)
    expect(dyn.pods.some((p) => p.directorId === 'cadence' && p.size >= 3)).toBe(
      true,
    )
    expect(dyn.coverage).toBeGreaterThan(0)
    expect(dyn.coverage).toBeLessThanOrEqual(1)
  })

  it('derives diamond fan-out/fan-in from managers with 2+ reports', () => {
    const diamonds = getDiamondWorkflows()
    const hermes = diamonds.find((d) => d.sourceId === 'hermes')
    const cadence = diamonds.find((d) => d.sourceId === 'cadence')
    expect(hermes).toBeTruthy()
    expect(hermes?.parallelIds.length).toBeGreaterThanOrEqual(10)
    expect(hermes?.sinkId).toBe('hermes')
    expect(cadence?.parallelIds).toEqual(
      expect.arrayContaining(['lego', 'brain', 'codegraph']),
    )
    expect(orgStats().diamonds).toBe(diamonds.length)
  })

  it('opens agent talk on the public /talk path, not /bevel/talk', () => {
    expect(agentTalkHref('hermes')).toBe('/talk/hermes')
    expect(agentTalkHref('johnny')).toBe('/talk/johnny')
    expect(agentTalkHref('scott')).toBe('/talk/hermes')
  })
})
