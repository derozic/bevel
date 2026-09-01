import { describe, expect, it } from 'vitest'
import {
  canonicalizeAgentId,
  mentionedCanonicalIds,
  resolveDispatchTargets,
} from './platform-roster'

const mixed = [
  { id: 'openai', name: 'ChatGPT' },
  { id: 'claude', name: 'Claude' },
  { id: 'hermes', name: 'Hermes' },
]

describe('platform roster targeting', () => {
  it('folds ChatGPT / Anthropic / xAI aliases', () => {
    expect(canonicalizeAgentId('chatgpt')).toBe('openai')
    expect(canonicalizeAgentId('anthropic')).toBe('claude')
    expect(canonicalizeAgentId('xai')).toBe('grok')
    expect(canonicalizeAgentId('hermes')).toBe('hermes')
  })

  it('resolves mixed @mentions in one turn', () => {
    expect(
      mentionedCanonicalIds('@chatgpt and @claude with @hermes', mixed),
    ).toEqual(['openai', 'claude', 'hermes'])
  })

  it('keeps @hermes plus platform seats even when only Hermes is seated', () => {
    expect(
      mentionedCanonicalIds(
        '@hermes @claude @grok @openai what is your favorite web framework and why?',
        [{ id: 'hermes', name: 'Hermes' }],
      ),
    ).toEqual(['hermes', 'claude', 'grok', 'openai'])
  })

  it('dispatches every mentioned platform agent, not just the first', () => {
    expect(
      resolveDispatchTargets({
        text: '@openai @claude draft the brief',
        agentIds: ['openai', 'claude', 'hermes'],
        agents: mixed,
      }),
    ).toEqual(['openai', 'claude'])
  })

  it('lets @chatgpt hit the OpenAI seat', () => {
    expect(
      resolveDispatchTargets({
        text: '@chatgpt ping',
        agentIds: ['openai', 'hermes'],
        agents: mixed,
      }),
    ).toEqual(['openai'])
  })

  it('broadcasts to the whole mixed room when nobody is @mentioned', () => {
    expect(
      resolveDispatchTargets({
        text: 'what should we ship first?',
        agentIds: ['openai', 'claude', 'hermes'],
        agents: mixed,
      }),
    ).toEqual(['openai', 'claude', 'hermes'])
  })
})
