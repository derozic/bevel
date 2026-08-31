import { describe, expect, it } from 'vitest'
import { parseChatAgentsParam, resolveChatAgents } from './chat-agents'

describe('chat agent query param', () => {
  it('accepts platform aliases in ?agents=', () => {
    expect(parseChatAgentsParam('chatgpt,claude,hermes')).toEqual([
      'openai',
      'claude',
      'hermes',
    ])
    expect(parseChatAgentsParam('anthropic,xai')).toEqual(['claude', 'grok'])
  })

  it('drops unknown ids and de-dupes', () => {
    expect(parseChatAgentsParam('openai,openai,not-an-agent')).toEqual([
      'openai',
    ])
    expect(parseChatAgentsParam('')).toBeNull()
  })

  it('falls back to the default Hermes-led roster', () => {
    const roster = resolveChatAgents(undefined)
    expect(roster[0]).toBe('hermes')
    expect(roster).not.toContain('openai')
  })
})
