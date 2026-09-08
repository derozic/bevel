import { describe, expect, it } from 'vitest'
import type { Tenant } from '@bevel/schema'
import { publicTenantUrl, tenantPublicHost } from './registry'

function tenant(partial: Partial<Tenant> & Pick<Tenant, 'host'>): Tenant {
  return {
    id: 't',
    slug: '2ndbrain',
    name: '2ndBrain',
    hosts: [],
    status: 'active',
    plan: 'pro',
    featureAccess: 'beta',
    auth: { providers: ['google'], requireGitHubForWork: false },
    features: {
      channels: true,
      directMessages: true,
      agentDispatch: true,
      workMode: false,
      customBranding: false,
      sms: false,
      otpSms: false,
      presenceSms: false,
      imessage: false,
      imessageInbox: false,
      asyncStreams: true,
      liveSessions: true,
      analytics: true,
      liveMedia: false,
      ssoSaml: false,
      auditLog: false,
      dedicatedSupport: false,
      agentMemory: false,
      voiceRooms: false,
      multiRegion: false,
      matrix: false,
      matrixFederation: false,
      matrixE2ee: false,
      matrixVoip: false,
      matrixExternalClients: false,
    },
    theme: { accent: '#7c5cff', mode: 'dark' },
    realtime: { namespace: '2ndbrain' },
    workRepos: [],
    ...partial,
  }
}

describe('tenantPublicHost', () => {
  const ws = tenant({
    host: 'bevel.2ndbra.in',
    hosts: ['bevel.2ndbra.in', 'bevel.2ndbrain.lvh.me', '2ndbrain.bevel.lvh.me'],
  })

  it('keeps a local session on the preview alias instead of production', () => {
    expect(tenantPublicHost(ws, 'bevel.lvh.me')).toBe('bevel.2ndbrain.lvh.me')
    expect(tenantPublicHost(ws, 'bevel.2x4m.lvh.me')).toBe('bevel.2ndbrain.lvh.me')
    expect(tenantPublicHost(ws, 'localhost')).toBe('bevel.2ndbrain.lvh.me')
    expect(tenantPublicHost(ws, '')).toBe('bevel.2ndbrain.lvh.me')
    expect(publicTenantUrl(ws, '/~general', 'bevel.lvh.me')).toBe(
      'https://bevel.2ndbrain.lvh.me/~general',
    )
  })

  it('stays on the current preview host when already on this tenant', () => {
    expect(tenantPublicHost(ws, 'bevel.2ndbrain.lvh.me')).toBe(
      'bevel.2ndbrain.lvh.me',
    )
  })

  it('uses the production domain from a production request', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(tenantPublicHost(ws, 'bevel.is')).toBe('bevel.2ndbra.in')
      expect(tenantPublicHost(ws, 'bevel.2x4m.cc')).toBe('bevel.2ndbra.in')
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it('never sends a local picker hop to a production host without DNS', () => {
    const olimbic = tenant({
      slug: 'olimbic',
      host: 'bevel.olimbic.games',
      hosts: ['bevel.olimbic.games', 'bevel.olimbic.lvh.me'],
    })
    expect(tenantPublicHost(olimbic, 'bevel.lvh.me')).toBe(
      'bevel.olimbic.lvh.me',
    )
    expect(publicTenantUrl(olimbic, '/~general', 'bevel.lvh.me')).not.toContain(
      'olimbic.games',
    )
  })

  it('keeps Decli on preview instead of bevel.decli.dev', () => {
    const decli = tenant({
      slug: 'decli',
      host: 'bevel.decli.dev',
      hosts: ['bevel.decli.dev', 'bevel.decli.lvh.me'],
    })
    expect(tenantPublicHost(decli, 'bevel.lvh.me')).toBe('bevel.decli.lvh.me')
    expect(tenantPublicHost(decli, 'bevel.lvh.me, 127.0.0.1')).toBe(
      'bevel.decli.lvh.me',
    )
    expect(publicTenantUrl(decli, '/~general', 'bevel.lvh.me')).toBe(
      'https://bevel.decli.lvh.me/~general',
    )
  })
})
