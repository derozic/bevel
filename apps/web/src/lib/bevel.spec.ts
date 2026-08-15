import { describe, expect, it } from 'vitest'
import {
  BEVEL_DEFAULT_CHANNEL,
  BEVEL_PRIVATE_PATH,
  bevelChannelPath,
  bevelConversationPath,
  bevelDirectPersistSlug,
  bevelDirectSessionId,
  bevelTalkPath,
  normalizeBevelChannelSlug,
} from './bevel'

describe('workspace URLs', () => {
  it('opens Private and talk on stable public paths', () => {
    expect(BEVEL_PRIVATE_PATH).toBe('/me')
    expect(bevelTalkPath('Hermes')).toBe('/talk/hermes')
    expect(bevelTalkPath('hermes', 'johnny')).toBe('/talk/hermes?agents=johnny')
  })

  it('normalizes channel slugs and rejects junk', () => {
    expect(normalizeBevelChannelSlug('~General')).toBe('general')
    expect(normalizeBevelChannelSlug('^ops')).toBe('ops')
    expect(normalizeBevelChannelSlug('%7Eproduct')).toBe('product')
    expect(normalizeBevelChannelSlug('../etc')).toBe(BEVEL_DEFAULT_CHANNEL)
    expect(bevelChannelPath('#general')).toBe('/~general')
  })

  it('routes single-agent threads to /talk even if roster is messy', () => {
    expect(
      bevelConversationPath({ sessionId: 'x', agentIds: ['hermes'] }),
    ).toBe('/talk/hermes')
    expect(
      bevelConversationPath({ sessionId: 'room-9', agentIds: ['hermes', 'johnny'] }),
    ).toBe('/session/room-9')
    expect(bevelConversationPath({ sessionId: 'orphan' })).toBe('/session/orphan')
    expect(bevelConversationPath({ sessionId: 'empty', agentIds: [] })).toBe(
      '/session/empty',
    )
  })

  it('builds a stable DM id so refresh resumes the same thread', () => {
    const a = bevelDirectSessionId('user/1', ['Johnny', 'hermes'])
    const b = bevelDirectSessionId('user/1', ['hermes', 'johnny', 'hermes'])
    expect(a).toBe(b)
    expect(a).toMatch(/^dm-user_1-hermes\+johnny$/)
  })

  it('maps a Hermes DM id to a durable 64-char slug', () => {
    expect(bevelDirectPersistSlug('dm-user_1-hermes+johnny')).toBe(
      'dm-user_1-hermes-johnny',
    )
    expect(bevelDirectPersistSlug(bevelDirectSessionId('usr_1', ['hermes']))).toBe(
      'dm-usr_1-hermes',
    )
    expect(bevelDirectPersistSlug('dm-Scott/foo-hermes').length).toBeLessThanOrEqual(
      64,
    )
  })

  it('hashes overlong DM slugs so two long threads cannot collide', () => {
    const long = `dm-${'a'.repeat(80)}-hermes`
    const slug = bevelDirectPersistSlug(long)
    expect(slug.length).toBe(64)
    expect(slug).not.toBe(bevelDirectPersistSlug(`${long}x`))
    expect(slug).toMatch(/-[0-9a-f]{8}$/)
  })
})
