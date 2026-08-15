import { describe, expect, it } from 'vitest'
import { agents, getAgentById } from './agent-catalog'
import {
  filterAgents,
  tokenizeRosterQuery,
} from './roster-search'

describe('roster search', () => {
  it('splits product + legal into tokens', () => {
    expect(tokenizeRosterQuery('product legal')).toEqual(['product', 'legal'])
    expect(tokenizeRosterQuery('product, legal')).toEqual(['product', 'legal'])
  })

  it('finds Helm on product bio/role and Portia on legal', () => {
    const product = filterAgents(agents, 'product').map((a) => a.id)
    const legal = filterAgents(agents, 'legal').map((a) => a.id)
    expect(product).toContain('helm')
    expect(legal).toContain('portia')
    expect(getAgentById('helm')?.bio.toLowerCase()).toContain('product')
    expect(getAgentById('portia')?.bio.toLowerCase()).toContain('legal')
  })

  it('lets you search product and legal in one query for a multi-select room', () => {
    const ids = filterAgents(agents, 'product legal').map((a) => a.id)
    expect(ids).toContain('helm')
    expect(ids).toContain('portia')
  })
})
