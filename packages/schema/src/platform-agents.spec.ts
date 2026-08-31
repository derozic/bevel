import { describe, expect, it } from 'vitest'
import {
  PLATFORM_AGENT_IDS,
  PLATFORM_AGENTS,
  isPlatformAgentId,
  resolvePlatformAgentId,
} from './platform-agents'

describe('platform agents', () => {
  it('exposes ChatGPT, Claude, and Grok as first-class seats', () => {
    expect(PLATFORM_AGENT_IDS).toEqual(['openai', 'claude', 'grok'])
    expect(PLATFORM_AGENTS.map((a) => a.id)).toEqual(['openai', 'claude', 'grok'])
    expect(PLATFORM_AGENTS[0]?.name).toBe('ChatGPT')
    expect(PLATFORM_AGENTS[1]?.name).toBe('Claude')
    expect(PLATFORM_AGENTS[2]?.name).toBe('Grok')
  })

  it('folds aliases to canonical ids', () => {
    expect(resolvePlatformAgentId('chatgpt')).toBe('openai')
    expect(resolvePlatformAgentId('OpenAI')).toBe('openai')
    expect(resolvePlatformAgentId('anthropic')).toBe('claude')
    expect(resolvePlatformAgentId('Claude')).toBe('claude')
    expect(resolvePlatformAgentId('xai')).toBe('grok')
    expect(resolvePlatformAgentId('Grok')).toBe('grok')
    expect(resolvePlatformAgentId('hermes')).toBeUndefined()
  })

  it('does not treat fleet directors as platform models', () => {
    expect(isPlatformAgentId('openai')).toBe(true)
    expect(isPlatformAgentId('hermes')).toBe(false)
    expect(isPlatformAgentId('johnny')).toBe(false)
  })
})
