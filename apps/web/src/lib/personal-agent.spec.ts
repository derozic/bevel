import { describe, expect, it } from 'vitest'
import {
  personalAgentTalkPath,
  resolvePersonalAgentId,
} from './personal-agent'

describe('personal agent', () => {
  it('defaults Private home to Hermes', () => {
    expect(resolvePersonalAgentId(null)).toBe('hermes')
    expect(resolvePersonalAgentId('')).toBe('hermes')
    expect(personalAgentTalkPath()).toBe('/talk/hermes')
  })

  it('honors a catalog agent and ignores unknown ids', () => {
    expect(resolvePersonalAgentId('johnny')).toBe('johnny')
    expect(resolvePersonalAgentId('not-an-agent')).toBe('hermes')
  })
})
